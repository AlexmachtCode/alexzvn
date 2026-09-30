import { EventEmitter } from 'node:events';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:tls';
import { normalizeFingerprint } from '@jm/auth-core';
import { kandidatenliste, listeKarten, wirksameKarten, type NetzwerkInterfaces } from './adresswahl';
import { signiereAnmeldung } from './beweis';
import { DateiBeobachter, type Kopplung, type MasterLinkDatei } from './datei';
import {
  fehlerText, ordneEin, PIN_FALSCH, RAHMEN, rueckzugMs, staerkster, wiederholung,
  type FehlerCode, type VersuchsErgebnis,
} from './fehler';
import { fristen as mitFristen, GRENZEN, kuerzeName, type Fristen } from './fristen';
import { MdnsSuche, standardFabrik, type SucheLike } from './mdns';
import { PROTOKOLL, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import { Verbindung } from './verbindung';

// Client eines Tools bzw. Slave-Launchers (Spec 4.4, 4.5, 5.1, 9). Liest master-link.json,
// sucht den Master (mDNS je Runde frisch → Datei → feste Adresse), meldet sich per Ed25519 an
// und hält die Verbindung mit Puls/Stille. Ohne Kopplung völlig untätig.

export type ClientZustand =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: FehlerCode; text: string; errCode?: string };

export type VerbundWert = 'aus' | 'sucht' | 'verbindet' | 'verbunden' | `fehler:${FehlerCode}`;

export function verbundWert(z: ClientZustand): VerbundWert {
  return z.art === 'fehler' ? `fehler:${z.code}` : z.art;
}

export interface Angemeldet {
  v: Verbindung;
  adresse: string;
  masterName: string;
  suite: string;
  adressen: string[];
}

export type Versuch = { ok: true; a: Angemeldet } | { ok: false; ergebnis: VersuchsErgebnis };

export interface AnmeldeParameter {
  adresse: string;
  kopplung: Kopplung;
  rechner: { id: string; name: string };
  teilnehmer: TeilnehmerInfo;
  f: Fristen;
  /**
   * Abbruch bei Generationswechsel bzw. stoppe(): der Socket wird sofort zerstört, spätestens vor dem Senden von
   * 'anmelden'. Sonst meldete sich ein langsamer alter Versuch NACH der neuen Verbindung an und verdrängte sie
   * am Master („ersetzt“, 60 s Pause — Endprüfung A5).
   */
  abbruch?: AbortSignal;
}

/** Ergebnis eines abgebrochenen Versuchs; die Schleife verwirft es (Generation vorbei). */
const ABGEBROCHEN: VersuchsErgebnis = { art: 'fehler', code: 'ABGEBROCHEN' };

/**
 * Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (jedes Tool).
 * Sie wird zum Fehlerergebnis mit err.code, eingeordnet wie ein Socket-Fehler (Spec 9.1, meist „sonstig“).
 */
function sicherIn<T extends unknown[]>(ende: (r: Versuch) => void, h: (...x: T) => void): (...x: T) => void {
  return (...x: T): void => {
    try {
      h(...x);
    } catch (e) {
      ende({ ok: false, ergebnis: { art: 'fehler', code: (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT' } });
    }
  };
}

/** Ein Anmeldeversuch an EINER Adresse: TCP-Frist → TLS mit Pin im Handshake → hallo → anmelden → angemeldet. */
export function versucheAnmeldung(p: AnmeldeParameter): Promise<Versuch> {
  if (p.abbruch?.aborted) return Promise.resolve({ ok: false, ergebnis: ABGEBROCHEN });
  return new Promise<Versuch>((fertig) => {
    let erledigt = false;
    let frist: ReturnType<typeof setTimeout> | null = null;
    let v: Verbindung | null = null;
    let masterName = p.kopplung.masterName;

    const socket = connect({
      host: p.adresse,
      port: p.kopplung.port,
      ca: [p.kopplung.zertifikat],
      rejectUnauthorized: true,
      // Pin IM Handshake (Spec 6.1): nur der Fingerprint zählt; das Zertifikat trägt keine IP.
      checkServerIdentity: (_host, cert) =>
        normalizeFingerprint(cert.fingerprint256 ?? '') === p.kopplung.fingerprint
          ? undefined
          : Object.assign(new Error('Zertifikat passt nicht zum Pin'), { code: PIN_FALSCH }),
    });

    const abbrechen = (): void => ende({ ok: false, ergebnis: ABGEBROCHEN });
    const ende = (r: Versuch): void => {
      if (erledigt) return;
      erledigt = true;
      if (frist) clearTimeout(frist);
      p.abbruch?.removeEventListener('abort', abbrechen);
      if (!r.ok) {
        v?.removeAllListeners();
        socket.destroy();
      }
      fertig(r);
    };
    const setzeFrist = (ms: number, e: VersuchsErgebnis): void => {
      if (frist) clearTimeout(frist);
      frist = setTimeout(() => ende({ ok: false, ergebnis: e }), ms);
    };
    p.abbruch?.addEventListener('abort', abbrechen, { once: true });

    setzeFrist(p.f.tcpMs, { art: 'tcp-timeout' });
    socket.once('connect', () => setzeFrist(p.f.tlsHalloMs, { art: 'frist' }));
    socket.on('error', (e: NodeJS.ErrnoException) => ende({ ok: false, ergebnis: { art: 'fehler', code: e.code ?? 'UNBEKANNT' } }));
    socket.once('secureConnect', sicherIn(ende, () => {
      // Spec 6.1: 4 KiB je Zeile bis 'angemeldet', danach 1 MiB.
      const verbindung = new Verbindung(socket, GRENZEN.vorAnmeldung);
      v = verbindung;
      verbindung.on('ende', (f?: Error) =>
        ende({ ok: false, ergebnis: f?.message === 'rahmen' ? { art: 'fehler', code: RAHMEN } : { art: 'frist' } }),
      );
      verbindung.on('nachricht', sicherIn(ende, (n: Nachricht) => {
        if (n.t === 'hallo') {
          if (p.abbruch?.aborted) {
            abbrechen();
            return;
          }
          if (n.masterId !== p.kopplung.masterId) {
            ende({ ok: false, ergebnis: { art: 'fehler', code: PIN_FALSCH } });
            return;
          }
          masterName = kuerzeName(n.name); // Fremdtext vom (gepinnten) Master: in Kopf, Log und Datei (A6, B5)
          verbindung.sende({
            t: 'anmelden',
            protokoll: PROTOKOLL,
            rechnerId: p.rechner.id,
            rechnerName: p.rechner.name,
            signatur: signiereAnmeldung(p.kopplung.schluessel.privat, p.kopplung.fingerprint, n.nonce, p.rechner.id),
            teilnehmer: p.teilnehmer,
          });
          setzeFrist(p.f.angemeldetMs, { art: 'frist' });
          return;
        }
        if (n.t === 'abgelehnt') {
          ende({ ok: false, ergebnis: { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite } });
          return;
        }
        if (n.t === 'angemeldet') {
          halteFest(verbindung);
          verbindung.setzeGrenze(GRENZEN.nachAnmeldung);
          ende({ ok: true, a: { v: verbindung, adresse: p.adresse, masterName, suite: n.suite, adressen: n.adressen } });
        }
      }));
    }));
  });
}

/**
 * Zwischen 'angemeldet' und dem Anhängen der Betriebs-Listener in betreibe() liegt ein Promise-Sprung. Weitere Zeilen
 * desselben Lese-Chunks gibt Verbindung synchron aus (z. B. 'abgelehnt ersetzt'); ohne Zuhörer gingen sie verloren.
 * Hier werden sie festgehalten und von betreibe() übernommen. Ein 'ende' in dieser Zeit steht in `Verbindung.offen`.
 */
const nachgelesen = new WeakMap<Verbindung, Nachricht[]>();

function halteFest(v: Verbindung): void {
  v.removeAllListeners();
  const liste: Nachricht[] = [];
  nachgelesen.set(v, liste);
  v.on('nachricht', (n: Nachricht) => liste.push(n));
}

function holeNachgelesenes(v: Verbindung): Nachricht[] {
  const liste = nachgelesen.get(v);
  if (!liste) return [];
  nachgelesen.delete(v);
  v.removeAllListeners();
  return liste;
}

/** Nach koppele(): 'teilnehmer' auf derselben Verbindung senden und auf 'angemeldet' warten. */
function warteAufAngemeldet(v: Verbindung, teilnehmer: TeilnehmerInfo, masterName: string, f: Fristen, abbruch: AbortSignal): Promise<Versuch> {
  return new Promise<Versuch>((fertig) => {
    let erledigt = false;
    const abbrechen = (): void => ende({ ok: false, ergebnis: ABGEBROCHEN });
    const ende = (r: Versuch): void => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(t);
      abbruch.removeEventListener('abort', abbrechen);
      if (!r.ok) {
        v.removeAllListeners();
        v.socket.destroy();
      }
      fertig(r);
    };
    const t = setTimeout(() => ende({ ok: false, ergebnis: { art: 'frist' } }), f.angemeldetMs);
    // Generationswechsel, während der Master noch antwortet: die Koppel-Verbindung sofort schließen (Endprüfung A5).
    abbruch.addEventListener('abort', abbrechen, { once: true });
    if (abbruch.aborted) {
      abbrechen();
      return;
    }
    v.on('ende', () => ende({ ok: false, ergebnis: { art: 'frist' } }));
    v.on('nachricht', sicherIn(ende, (n: Nachricht) => {
      if (n.t === 'abgelehnt') {
        ende({ ok: false, ergebnis: { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite } });
        return;
      }
      if (n.t === 'angemeldet') {
        halteFest(v);
        ende({ ok: true, a: { v, adresse: v.adresse, masterName, suite: n.suite, adressen: n.adressen } });
      }
    }));
    v.sende({ t: 'teilnehmer', teilnehmer });
  });
}

export interface ClientOptionen {
  dateiPfad: string;
  teilnehmer: TeilnehmerInfo;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Vorgabe: echtes mDNS; null = keine Suche (Tests, Rolle master braucht keine). */
  suche?: SucheLike | null;
  jetzt?: () => number;
  zufall?: () => number;
  log?: (stufe: 'info' | 'warn', text: string) => void;
  /** Test-Naht: ersetzt den echten Anmeldeversuch. */
  anmelden?: (p: AnmeldeParameter) => Promise<Versuch>;
}

/** Ergebnis eines Versuchs samt der Adresse, an der es entstand (für den Fehlertext). */
interface RundenErgebnis {
  e: VersuchsErgebnis;
  adresse?: string;
}

type BetriebsEnde = { art: 'ende' } | { art: 'abgelehnt'; grund: Grund; master?: number; suite?: string };

/** Antworten, die nur der gepinnte Master selbst geben kann (TLS mit Pin bestanden bzw. sein Zertifikat). */
const VOM_MASTER: ReadonlySet<FehlerCode> = new Set<FehlerCode>(['unbekannt', 'signatur', 'protokoll', 'uhr', 'ersetzt']);

/** Ausgang einer Runde: Generation vorbei, sofort weiter (nach einer Verbindungsphase) oder erst warten. */
type Schritt = { art: 'ende' } | { art: 'weiter' } | { art: 'warte'; ms: number };

/** Code einer lokalen Ausnahme für Anzeige und Log: err.code, sonst der Fehlertyp — nie die Meldung (sie kann Fremdtext zitieren). */
function wurfCode(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; name?: unknown };
  const roh = typeof o.code === 'string' && o.code ? o.code : typeof o.name === 'string' && o.name ? o.name : 'UNBEKANNT';
  return roh.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'UNBEKANNT';
}

export class MasterLinkClient extends EventEmitter {
  private readonly o: ClientOptionen;
  private readonly f: Fristen;
  private readonly beobachter: DateiBeobachter;
  private readonly suche: SucheLike | null;
  private readonly netz: () => NetzwerkInterfaces;
  private readonly jetzt: () => number;
  private readonly anmelden: (p: AnmeldeParameter) => Promise<Versuch>;
  private z: ClientZustand = { art: 'aus' };
  private datei: MasterLinkDatei | null = null;
  private laeuft = false;
  /** Jede relevante Änderung erhöht die Generation; alte Schleifen beenden sich daran. */
  private generation = 0;
  /** Gehört zur laufenden Generation; neueGeneration() bricht ihn ab. */
  private abbruch = new AbortController();
  private verbindung: Verbindung | null = null;
  private dateiZeitgeber: ReturnType<typeof setInterval> | null = null;
  private weckeAuf: (() => void) | null = null;
  /** Beendet die laufende Verbindungsphase (Puls und Stille löschen), auch wenn der Socket kein 'ende' mehr meldet. */
  private beendeBetrieb: (() => void) | null = null;
  /** Zuletzt geloggter Wert (samt errCode); null = nach einer verlorenen Verbindung wird der nächste Wert wieder gemeldet. */
  private geloggt: string | null = 'aus';
  /** Zuletzt geloggte Ausnahme eines Zuhörers — je Meldungswechsel eine Zeile. */
  private wurfGeloggt: string | null = null;
  /**
   * true = noch kein Ergebnis in dieser Phase (nach starte/neustart/uebernehme oder nach dem Ende einer Verbindung):
   * nur dann werden „sucht“/„verbindet“ gemeldet. Ein Ergebnis (Fehler, verbunden) setzt es zurück (Ruling jj).
   */
  private frisch = true;
  private letzteAdresse: string | null = null;
  private gelernteAdressen: string[] = [];

  constructor(o: ClientOptionen) {
    super();
    this.o = o;
    this.f = mitFristen(o.fristen);
    this.beobachter = new DateiBeobachter(o.dateiPfad, (t) => this.log('warn', `Master-Link: ${t}`));
    this.netz = o.netzwerkKarten ?? networkInterfaces;
    this.jetzt = o.jetzt ?? Date.now;
    this.anmelden = o.anmelden ?? versucheAnmeldung;
    this.suche = o.suche === undefined ? new MdnsSuche(standardFabrik((t) => this.log('warn', t))) : o.suche;
  }

  zustand(): ClientZustand {
    return this.z;
  }

  /** Neue Generation: alte Schleifen beenden sich daran, laufende Anmeldeversuche der alten brechen sofort ab (A5). */
  private neueGeneration(): void {
    this.generation++;
    this.abbruch.abort();
    this.abbruch = new AbortController();
  }

  starte(): void {
    if (this.laeuft) return;
    this.laeuft = true;
    this.pruefeDatei(true);
    this.dateiZeitgeber = setInterval(() => this.pruefeDatei(), this.f.dateiPruefMs);
    this.dateiZeitgeber.unref?.();
  }

  async stoppe(): Promise<void> {
    this.laeuft = false;
    this.neueGeneration();
    if (this.dateiZeitgeber) {
      clearInterval(this.dateiZeitgeber);
      this.dateiZeitgeber = null;
    }
    this.weckeAuf?.();
    this.trenne();
    this.suche?.stoppe();
    this.setze({ art: 'aus' });
  }

  /** Nach koppele(): Launcher hat master-link.json schon geschrieben → einlesen, Verbindung weiterführen. */
  uebernehme(v: Verbindung, kopplung: Kopplung, masterName: string): void {
    const b = this.beobachter.pruefe();
    if (b.art === 'geaendert') this.datei = b.datei;
    this.neueGeneration();
    this.weckeAuf?.();
    this.trenne();
    const gen = this.generation;
    const d = this.datei;
    if (!this.laeuft || !d || !d.kopplung || d.kopplung.fingerprint !== kopplung.fingerprint) {
      v.schliesse();
      if (this.laeuft) this.neustart();
      return;
    }
    this.frisch = true;
    this.setze({ art: 'verbindet', adresse: v.adresse });
    this.starteSchleife(gen, warteAufAngemeldet(v, this.o.teilnehmer, masterName, this.f, this.abbruch.signal));
  }

  /** `beimStart`: nach stoppe() → starte() auch bei unveränderter Datei mit dem letzten gültigen Stand neu aufbauen. */
  private pruefeDatei(beimStart = false): void {
    const b = this.beobachter.pruefe();
    if (b.art === 'unveraendert') {
      if (beimStart) this.neustart();
      return;
    }
    if (b.art === 'defekt') {
      if (this.z.art === 'fehler' && this.z.code === 'datei') return;
      this.neueGeneration();
      this.weckeAuf?.();
      this.trenne();
      this.setze({ art: 'fehler', code: 'datei', text: fehlerText('datei', { masterName: this.datei?.kopplung?.masterName ?? '' }) });
      return;
    }
    this.datei = b.datei;
    // Nach stoppe() bewertet der Beobachter gegen seinen gemerkten Stand: auch „nicht relevant“ (nur Adressen/Namen) baut beim Start neu auf.
    if (b.relevant || beimStart) this.neustart();
  }

  private neustart(): void {
    this.neueGeneration();
    this.weckeAuf?.();
    this.trenne();
    this.letzteAdresse = null;
    this.gelernteAdressen = [];
    this.frisch = true;
    const d = this.datei;
    if (!this.laeuft || !d || d.rolle === 'aus' || !d.kopplung) {
      this.suche?.stoppe();
      this.setze({ art: 'aus' });
      return;
    }
    this.starteSchleife(this.generation);
  }

  /** Letzte Absicherung: schleife() fängt jede Runde selbst; eine Ablehnung hier wäre ein Programmfehler — geloggt, nie unbehandelt. */
  private starteSchleife(gen: number, erster?: Promise<Versuch>): void {
    this.schleife(gen, erster).catch((e: unknown) => this.log('warn', `Master-Link: Suchschleife beendet (${wurfCode(e)}).`));
  }

  /**
   * Eine Generation: Runde um Runde, bis sie endet. Jede Ausnahme einer Runde (networkInterfaces, Bonjour-Fabrik,
   * Suche …) wird zum Fehlerergebnis (meist fehler:sonstig mit errCode) — die Schleife wartet den Rückzug ab und
   * läuft weiter. Ohne das stürbe sie still an einer unbehandelten Ablehnung (Endprüfung A1, Spec 7.3).
   */
  private async schleife(gen: number, erster?: Promise<Versuch>): Promise<void> {
    const zaehler = { versuch: 0 };
    let erst = erster;
    while (this.laeuft && gen === this.generation) {
      let s: Schritt;
      try {
        s = erst ? await this.ersteRunde(gen, erst, zaehler) : await this.runde(gen, zaehler);
      } catch (e) {
        if (gen !== this.generation || !this.laeuft) return;
        const w = this.werteAus([{ e: { art: 'fehler', code: wurfCode(e) } }], false, zaehler.versuch++);
        s = w === null ? { art: 'ende' } : { art: 'warte', ms: w };
      }
      erst = undefined;
      if (s.art === 'ende') return;
      if (s.art === 'warte') await this.warte(s.ms, gen);
    }
  }

  /** Nach uebernehme(): die schon laufende Anmeldung auf der Koppel-Verbindung auswerten. */
  private async ersteRunde(gen: number, erster: Promise<Versuch>, zaehler: { versuch: number }): Promise<Schritt> {
    const r = await erster;
    if (gen !== this.generation || !this.laeuft) {
      if (r.ok) r.a.v.schliesse();
      return { art: 'ende' };
    }
    if (r.ok) return (await this.verbunden(r.a, gen)) ? { art: 'weiter' } : { art: 'ende' };
    const w = this.werteAus([{ e: r.ergebnis }], false, zaehler.versuch++);
    return w === null ? { art: 'ende' } : { art: 'warte', ms: w };
  }

  private async runde(gen: number, zaehler: { versuch: number }): Promise<Schritt> {
    const d = this.datei;
    if (!d || !d.kopplung || d.rolle === 'aus') return { art: 'ende' };
    const kopplung = d.kopplung;
    this.setze({ art: 'sucht' });
    const alleKarten = listeKarten(this.netz());
    let mdns: string[] = [];
    let mdnsGesehen = false;
    if (d.rolle === 'slave' && this.suche) {
      this.suche.setzeKarten(wirksameKarten(alleKarten, d.netzwerk.karte).karten);
      const sichtungen = await this.suche.runde(this.f.suchrundeMs);
      if (gen !== this.generation) return { art: 'ende' };
      const meine = sichtungen.filter((s) => s.masterId === kopplung.masterId);
      mdnsGesehen = meine.length > 0;
      mdns = meine.flatMap((s) => s.adressen);
    }
    const kandidaten = kandidatenliste({
      rolle: d.rolle === 'master' ? 'master' : 'slave',
      mdns,
      letzteAdresse: this.letzteAdresse ?? kopplung.letzteAdresse,
      adressen: [...this.gelernteAdressen, ...kopplung.adressen],
      festeAdresse: kopplung.festeAdresse,
      karten: alleKarten,
      gewaehlteKarte: d.netzwerk.karte,
    });
    const ergebnisse: RundenErgebnis[] = [];
    for (const adresse of kandidaten) {
      if (gen !== this.generation || !this.laeuft) return { art: 'ende' };
      this.setze({ art: 'verbindet', adresse });
      const r = await this.anmelden({ adresse, kopplung, rechner: d.rechner, teilnehmer: this.o.teilnehmer, f: this.f, abbruch: this.abbruch.signal });
      if (gen !== this.generation || !this.laeuft) {
        if (r.ok) r.a.v.schliesse();
        return { art: 'ende' };
      }
      if (r.ok) {
        zaehler.versuch = 0;
        return (await this.verbunden(r.a, gen)) ? { art: 'weiter' } : { art: 'ende' };
      }
      ergebnisse.push({ e: r.ergebnis, adresse });
      const e = ordneEin(r.ergebnis, mdnsGesehen);
      // Unser Master hat geantwortet (Pin passte) — andere Adressen ändern daran nichts.
      if (e.art === 'code' && ['unbekannt', 'signatur', 'protokoll', 'uhr'].includes(e.code)) break;
    }
    const w = this.werteAus(ergebnisse, mdnsGesehen, zaehler.versuch++);
    return w === null ? { art: 'ende' } : { art: 'warte', ms: w };
  }

  /**
   * Setzt den Zustand aus den Ergebnissen einer Runde; liefert die Wartezeit oder null (keine Wiederholung).
   * Adresse, errCode und Masterstand im Text stammen vom ersten Ergebnis, das den angezeigten (stärksten) Code lieferte.
   */
  private werteAus(ergebnisse: RundenErgebnis[], mdnsGesehen: boolean, versuch: number): number | null {
    const codes: FehlerCode[] = [];
    const herkunft = new Map<FehlerCode, RundenErgebnis>();
    let intern: 'anmeldefrist' | 'last' | null = null;
    for (const r of ergebnisse) {
      const o = ordneEin(r.e, mdnsGesehen);
      if (o.art === 'intern') intern = intern === 'last' ? 'last' : o.grund;
      else {
        codes.push(o.code);
        if (!herkunft.has(o.code)) herkunft.set(o.code, r);
      }
    }
    if (ergebnisse.length === 0) codes.push('nicht-gefunden');
    // Hat UNSER Master (Pin passte) mit last/anmeldefrist geantwortet, sagen Netzfehler anderer Adressen nichts über ihn:
    // sie würden „Master-Modus aus?“ bzw. „nicht erreichbar“ behaupten (Spec 5.4). Nur seine eigenen Antworten zählen.
    const gezeigt = intern ? codes.filter((c) => VOM_MASTER.has(c)) : codes;
    const code = staerkster(gezeigt);
    // Spec 9.1: „last: frühestens nach 5 s“ — auch wenn andere Adressen derselben Runde anders endeten.
    const mindestens = (ms: number): number => (intern === 'last' ? Math.max(this.f.lastMinMs, ms) : ms);
    if (code) {
      const quelle = herkunft.get(code);
      const adresse = quelle?.adresse;
      const errCode = quelle?.e.art === 'fehler' ? quelle.e.code : undefined;
      const ablehnung = quelle?.e.art === 'abgelehnt' ? quelle.e : undefined;
      const masterName = this.datei?.kopplung?.masterName ?? '';
      this.setze({
        art: 'fehler',
        code,
        text: fehlerText(code, { masterName, adresse, errCode, suite: ablehnung?.suite === undefined ? undefined : kuerzeName(ablehnung.suite), masterProtokoll: ablehnung?.master }),
        ...(code === 'sonstig' && errCode ? { errCode } : {}),
      });
      const w = wiederholung(code, this.f);
      if (w.art === 'keine') return null;
      return mindestens(w.art === 'fest' ? w.ms : rueckzugMs(versuch, this.f, this.o.zufall));
    }
    this.setze({ art: 'sucht' });
    return mindestens(rueckzugMs(versuch, this.f, this.o.zufall));
  }

  /** Verbunden-Phase; true = Schleife geht weiter, false = aufhören (keine Wiederholung/Generation vorbei). */
  private async verbunden(a: Angemeldet, gen: number): Promise<boolean> {
    const aus = await this.betreibe(a);
    if (gen !== this.generation || !this.laeuft) return false;
    if (aus.art === 'abgelehnt') {
      const w = this.werteAus([{ e: { art: 'abgelehnt', grund: aus.grund, master: aus.master, suite: aus.suite } }], true, 0);
      if (w === null) return false;
      await this.warte(w, gen);
      return gen === this.generation && this.laeuft;
    }
    // Ende der Verbindungsphase: die nächste Suche ist wieder „frisch“ und wird angezeigt (Ruling jj).
    this.frisch = true;
    this.setze({ art: 'sucht' });
    await this.warte(rueckzugMs(0, this.f, this.o.zufall), gen);
    return gen === this.generation && this.laeuft;
  }

  private betreibe(a: Angemeldet): Promise<BetriebsEnde> {
    return new Promise<BetriebsEnde>((fertig) => {
      const nachgeholt = holeNachgelesenes(a.v);
      let ergebnis: BetriebsEnde = { art: 'ende' };
      const merke = (n: Nachricht): void => {
        if (n.t === 'abgelehnt') ergebnis = { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite };
      };
      if (!a.v.offen) {
        // Schon zu (z. B. kaputte Zeile im selben Lese-Chunk wie 'angemeldet'): nie „verbunden“ melden, nur das Nachgelesene auswerten.
        for (const n of nachgeholt) merke(n);
        fertig(ergebnis);
        return;
      }
      this.verbindung = a.v;
      this.letzteAdresse = a.adresse;
      this.gelernteAdressen = a.adressen;
      this.setze({ art: 'verbunden', adresse: a.adresse, seit: this.jetzt(), masterName: a.masterName, suite: a.suite });
      this.sendeEreignis('angemeldet', { adresse: a.adresse, adressen: a.adressen, suite: a.suite });
      let beendet = false;
      let stille: ReturnType<typeof setTimeout> | null = null;
      // Jedes Ende (ende des Sockets, Stille, trenne()) räumt auf und löst die Verbindungsphase auf — genau einmal.
      const beende = (): void => {
        if (beendet) return;
        beendet = true;
        if (stille) clearTimeout(stille);
        clearInterval(puls);
        if (this.verbindung === a.v) this.verbindung = null;
        if (this.beendeBetrieb === beende) this.beendeBetrieb = null;
        fertig(ergebnis);
      };
      const setzeStille = (): void => {
        if (beendet) return;
        if (stille) clearTimeout(stille);
        // Nicht auf ein zweites 'ende' warten: ein schon zerstörter Socket meldet keines mehr.
        stille = setTimeout(() => {
          a.v.socket.destroy();
          beende();
        }, this.f.stilleMs);
      };
      const puls = setInterval(() => a.v.sende({ t: 'puls' }), this.f.pulsMs);
      this.beendeBetrieb = beende;
      setzeStille();
      const aufNachricht = (n: Nachricht): void => {
        setzeStille();
        merke(n);
      };
      a.v.on('nachricht', aufNachricht);
      a.v.on('unbekannt', setzeStille);
      a.v.on('ende', beende);
      for (const n of nachgeholt) aufNachricht(n);
    });
  }

  private trenne(): void {
    const v = this.verbindung;
    this.verbindung = null;
    v?.schliesse();
    this.beendeBetrieb?.();
  }

  private warte(ms: number, gen: number): Promise<void> {
    if (gen !== this.generation) return Promise.resolve();
    return new Promise<void>((fertig) => {
      const aufwachen = (): void => {
        clearTimeout(t);
        if (this.weckeAuf === aufwachen) this.weckeAuf = null;
        fertig();
      };
      const t = setTimeout(aufwachen, ms);
      this.weckeAuf = aufwachen;
    });
  }

  private setze(z: ClientZustand): void {
    const alt = this.z;
    // Ruling (jj): nach einem Ergebnis ist „sucht“/„verbindet“ der Wiederholung kein neuer Zustand — der Fehler bleibt
    // stehen, bis ein neues Ergebnis kommt (verbunden oder ein anderer Fehler). Sonst flackerte der Kopf je Runde.
    if ((z.art === 'sucht' || z.art === 'verbindet') && !this.frisch && alt.art === 'fehler') return;
    if (z.art === 'fehler' || z.art === 'verbunden') this.frisch = false;
    if (JSON.stringify(alt) === JSON.stringify(z)) return;
    this.z = z;
    // Geloggt wird nur das Ergebnis einer Runde (verbunden, aus, neuer Fehlercode), nicht sucht/verbindet: sonst schreibt ein
    // Dauerfehler (Master aus ist ein Normalzustand) jede Runde dieselben Zeilen. Das Ereignis 'zustand' bleibt vollständig.
    if (alt.art === 'verbunden' && z.art !== 'verbunden') this.geloggt = null;
    const wert = verbundWert(z);
    const logSchluessel = z.art === 'fehler' && z.errCode ? `${wert}/${z.errCode}` : wert;
    if (z.art !== 'sucht' && z.art !== 'verbindet' && logSchluessel !== this.geloggt) {
      this.geloggt = logSchluessel;
      const zusatz = z.art === 'verbunden' ? ` (${z.adresse})` : z.art === 'fehler' ? ` — ${z.text}` : '';
      this.log(z.art === 'fehler' ? 'warn' : 'info', `Master-Link: ${wert}${zusatz}`);
    }
    this.sendeEreignis('zustand', z);
  }

  /** Ein werfender Zuhörer darf weder die Schleife noch den Socket-Handler treffen (Endprüfung A1). */
  private sendeEreignis(name: string, wert: unknown): void {
    try {
      this.emit(name, wert);
    } catch (e) {
      const schluessel = `${name}/${wurfCode(e)}`;
      if (schluessel === this.wurfGeloggt) return;
      this.wurfGeloggt = schluessel;
      this.log('warn', `Master-Link: Zuhörer von „${name}“ warf (${wurfCode(e)}).`);
    }
  }

  private log(stufe: 'info' | 'warn', text: string): void {
    this.o.log?.(stufe, text);
  }
}
