// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: Zustandsmaschine (Master-Link Teil 2b, Release 2, Spec 13.2, 13.3, 16.1–16.3).
//
// Rein: kein Electron, kein fs. Client, Zwischenspeicher, Log und Uhr kommen von außen;
// verbund.ts verdrahtet sie im Tool, der Selbsttest mit Attrappen. Jede Frist läuft als
// Zeitgeber der übergebenen Uhr, nie über Date.now()-Differenzen (G13). `jetzt()` liefert nur
// die Empfangszeit für „Stand hh:mm“ (bewusst die Uhr dieses Rechners, 16.4).
//
// • Nach jeder Anmeldung (`angemeldet`) schickt ein Tool, das folgt (Handler registriert), mit Rolle
//   Slave und Kopplung ein `abo` (13.3); registriert es sich erst später, geht das Abo dann hinaus.
//   Andere Tools und Rolle Master schicken keines (15.5, E29). Ohne Antwort nach 5 s gilt
//   `ohne-daten`; das Abo geht alle 30 s erneut, solange die Verbindung steht und keine Antwort kam.
// • Ein gültiger Stand mit Show, der neuer ist (andere Epoche oder größere Folge als der
//   angewendete bzw. der gerade versuchte), wird angewendet. Wirft `anwenden`, gilt `fehler`:
//   bis zu fünf neue Versuche im Abstand von 1 s („erneut“, 16.2), ein neuerer Stand ersetzt das Ziel.
// • Ein ungültiger Stand wird verworfen (`verworfen`), Warnung je Verbindung einmal je Typ und Feld (13.2).
// • Der Zwischenspeicher wird beim Start genau einmal mit `anwenden(stand, false)` angewendet,
//   sobald der Handler registriert ist UND `starte()` lief (16.3, E17).
// • `daten()` leitet die Lage bei jedem Aufruf neu aus Client, Kopplung und den Merkern ab.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'node:events';
import { migrateShow, type Show } from '@jm/show';
import {
  kodiereAbo,
  kuerzeName,
  pruefeStand,
  type ClientZustand,
  type DatenZeile,
  type KopplungInfo,
  type Nachricht,
} from '@jm/master-link';
import type { FolgeHandler, MasterStand, VerbundDaten, VerbundKopplung } from './verbund-typen';

export interface VerbundFristen {
  antwortMs: number;
  aboWiederholMs: number;
  anwendeVersuche: number;
  anwendePauseMs: number;
}

export const VERBUND_FRISTEN: Readonly<VerbundFristen> = { antwortMs: 5000, aboWiederholMs: 30000, anwendeVersuche: 5, anwendePauseMs: 1000 };

/** „ignoriert“-Zeilen aus 16.1 höchstens einmal je Minute und Weg (E19). */
const IGNORIERT_DROSSEL_MS = 60_000;

export interface ClientLike {
  zustand(): ClientZustand;
  kopplung(): KopplungInfo | null;
  sende(n: Nachricht): boolean;
  on(e: 'zustand' | 'angemeldet' | 'daten', f: (x: any) => void): unknown;
}

export interface Uhr {
  jetzt(): number;
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

export interface StandSpeicher {
  lies(): MasterStand | null;
  schreibe(s: MasterStand): Promise<boolean>;
  loesche(): void;
}

const ECHTE_UHR: Uhr = {
  jetzt: () => Date.now(),
  setTimeout: (f, ms) => {
    const t = setTimeout(f, ms);
    t.unref?.();
    return t;
  },
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

type MitShow = MasterStand & { show: Show };

interface Ziel {
  stand: MitShow;
  /** null = beim ersten Versuch gegen den dann angewendeten Stand bestimmen. */
  neueShow: boolean | null;
  /** Stand aus dem Zwischenspeicher: nach dem Anwenden nicht noch einmal schreiben. */
  ausSpeicher: boolean;
  /** Verbleibende Aufrufe von anwenden: der erste und bis zu `anwendeVersuche` neue (16.2 „erneut“). */
  rest: number;
}

/** Grund aus einer Ausnahme: err.code, sonst der Fehlertyp — nie die Meldung (G6). */
function grundAus(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; name?: unknown };
  const roh = typeof o.code === 'string' && o.code ? o.code : typeof o.name === 'string' && o.name ? o.name : 'unbekannt';
  return roh.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'unbekannt';
}

/**
 * Wurf für `FolgeHandler.anwenden`, wenn ein Tool einen Stand nicht anwenden kann (Spec 16.2): V12 und die Logzeile
 * zeigen `code` (grundAus nimmt `err.code`, nie die Meldung, G6); ein einfaches `Error` ergäbe nur „Error“. `code` aus
 * `[A-Za-z0-9_.-]`, höchstens 40 Zeichen, etwa `EBUSY` oder `SCHLUESSEL_FEHLT`.
 */
export function nichtAngewendet(code: string): Error & { code: string } {
  return Object.assign(new Error(`Stand nicht angewendet (${code})`), { code });
}

/** Vergleichsform für 'wechsel': die Show nur über ihren Namen (ein Stand kann 900 KiB groß sein). */
function signatur(d: VerbundDaten): string {
  return JSON.stringify(d, (k, v: unknown) => (k === 'show' && v && typeof v === 'object' ? (v as { name?: unknown }).name : v));
}

export class VerbundFolger extends EventEmitter {
  private readonly client: ClientLike;
  private readonly speicher: StandSpeicher;
  private readonly logFn: (stufe: 'info' | 'warn', t: string) => void;
  private readonly uhr: Uhr;
  private readonly f: VerbundFristen;
  private readonly darfSchreiben: boolean;
  private handler: FolgeHandler | null = null;
  private gestartet = false;
  private gestoppt = false;
  /** Gelesener Zwischenspeicher, bis er angewendet ist (E17). */
  private vorrat: MasterStand | null = null;
  private vorratErledigt = false;
  private angewendet: MasterStand | null = null;
  /** Zuletzt empfangener gültiger Stand DIESER Verbindung. */
  private letzter: MasterStand | null = null;
  private antwortDa = false;
  private aboInDieserVerbindung = false;
  private fristAbgelaufen = false;
  private fehler: string | undefined;
  private verworfen: { grund: string; seit: number } | undefined;
  /** Zu welchem Master `fehler` bzw. `verworfen` gehören: beides gilt nur für diesen einen Master. */
  private fehlerMasterId: string | undefined;
  private verworfenMasterId: string | undefined;
  private ziel: Ziel | null = null;
  private antwortZeitgeber: unknown = null;
  private wiederholZeitgeber: unknown = null;
  private versuchZeitgeber: unknown = null;
  /** Warnungen dieser Verbindung, je `${t}/${feld}` (13.2). */
  private readonly gewarnt = new Set<string>();
  private readonly gedrosselt = new Map<'reload' | 'deeplink', unknown>();
  private gemeldet = '';
  private wartend: MasterStand | null = null;
  private schreibt = false;
  private schreibGeneration = 0;
  private wurfGeloggt = '';

  constructor(o: {
    client: ClientLike;
    speicher: StandSpeicher;
    log(stufe: 'info' | 'warn', t: string): void;
    uhr?: Uhr;
    fristen?: Partial<VerbundFristen>;
    darfSchreiben?: boolean;
  }) {
    super();
    this.client = o.client;
    this.speicher = o.speicher;
    this.logFn = (stufe, t) => o.log(stufe, t);
    this.uhr = o.uhr ?? ECHTE_UHR;
    this.f = { ...VERBUND_FRISTEN, ...o.fristen };
    this.darfSchreiben = o.darfSchreiben ?? true;
  }

  /** Registriert den Handler des Tools; wendet einen lesbaren Zwischenspeicher an, sobald auch starte() lief (E17). */
  folge(h: FolgeHandler): void {
    if (this.gestoppt) return;
    this.handler = h;
    this.wendeVorratAn();
    this.versuche(); // ein Stand, der vor der Registrierung kam
    this.starteAbo(); // schon verbunden: das Abo geht jetzt hinaus
    this.melde();
  }

  /** Der Client läuft (Sperre der App, whenReady): Zwischenspeicher lesen, Zuhörer anhängen. */
  starte(): void {
    if (this.gestartet || this.gestoppt) return;
    this.gestartet = true;
    this.vorrat = this.vorratErledigt ? null : this.speicher.lies();
    this.client.on('zustand', (z: ClientZustand) => this.aufZustand(z));
    this.client.on('angemeldet', () => this.aufAngemeldet());
    this.client.on('daten', (n: DatenZeile) => this.aufDaten(n));
    this.wendeVorratAn();
    if (this.client.zustand().art === 'verbunden') this.aufAngemeldet();
    this.melde();
  }

  stoppe(): void {
    this.gestoppt = true;
    this.stoppeAboZeitgeber();
    this.beendeVersuche();
    for (const t of this.gedrosselt.values()) this.uhr.clearTimeout(t);
    this.gedrosselt.clear();
  }

  daten(): VerbundDaten {
    const z = this.client.zustand();
    const k = this.client.kopplung();
    const a = this.angewendet;
    if (z.art === 'fehler' && z.code === 'datei') {
      return a ? { art: 'frueher', grund: 'datei', ...this.mitStand(a.masterName) } : { art: 'datei-defekt' };
    }
    if (!this.istSlave(k)) {
      return a ? { art: 'frueher', grund: 'entkoppelt', ...this.mitStand(a.masterName) } : { art: 'einzelplatz' };
    }
    const m = this.mitStand(this.masterName(k));
    if (z.art !== 'verbunden') return { art: 'getrennt', client: z, ...m };
    if (this.letzter) return { art: 'aktuell', letzter: this.letzter, ...m };
    return this.fristAbgelaufen ? { art: 'ohne-daten', ...m } : { art: 'warte', ...m };
  }

  /** Slave mit Kopplung, Datei lesbar, und der angewendete Stand stammt von DIESEM Master (16.1). */
  imVerbundmodus(): boolean {
    const z = this.client.zustand();
    if (z.art === 'fehler' && z.code === 'datei') return false;
    const k = this.client.kopplung();
    return this.istSlave(k) && this.angewendet !== null && this.angewendet.masterId === k.masterId;
  }

  /** verbundDatenErsetzt (E16): Zwischenspeicher löschen, `angewendet` null; aus `frueher` wird `einzelplatz`. */
  ersetzt(): void {
    this.angewendet = null;
    this.vorrat = null;
    this.vorratErledigt = true;
    this.fehler = undefined;
    this.beendeVersuche();
    this.wartend = null;
    this.schreibGeneration++;
    if (this.darfSchreiben) this.speicher.loesche();
    this.melde();
  }

  kopplung(): VerbundKopplung | null {
    const k = this.client.kopplung();
    if (!k) return null;
    const z = this.client.zustand();
    return {
      rolle: k.rolle,
      masterId: k.masterId,
      masterName: k.masterName,
      masterAdresse: z.art === 'verbunden' ? z.adresse : null,
      adressen: [...k.adressen],
      letzteAdresse: k.letzteAdresse,
    };
  }

  /** Logzeilen aus 16.1 für ignoriertes RELOAD bzw. einen Show-Deep-Link, höchstens einmal je Minute und Weg (E19). */
  ignoriert(weg: 'reload' | 'deeplink', pfad?: string): void {
    if (this.gestoppt || this.gedrosselt.has(weg)) return;
    const k = this.client.kopplung();
    const m = this.istSlave(k) ? this.masterName(k) : (this.angewendet?.masterName ?? 'Master');
    this.log(
      'info',
      weg === 'reload'
        ? `Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „${m}“.`
        : `Verbund: Show-Deep-Link „${pfad ?? ''}“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „${m}“.`,
    );
    this.gedrosselt.set(weg, this.uhr.setTimeout(() => this.gedrosselt.delete(weg), IGNORIERT_DROSSEL_MS));
  }

  // ── Ereignisse des Clients ──────────────────────────────────────────────────

  private aufZustand(z: ClientZustand): void {
    if (this.gestoppt) return;
    if (z.art !== 'verbunden') this.verbindungVorbei();
    // Ende des Verbunds (entkoppelt, Rolle aus oder Master, Datei beschädigt) oder direkt ein anderer Master (16.1
    // „Anderer Master“): Ein Stand des bisherigen Masters wird nicht weiter versucht. Ein Stand aus dem
    // Zwischenspeicher gehört zum Start (16.3) und bleibt im Versuch.
    const k = this.client.kopplung();
    if (this.ziel && !this.ziel.ausSpeicher && (!this.istSlave(k) || this.ziel.stand.masterId !== k.masterId)) this.beendeVersuche();
    // `fehler` und `verworfen` gehören zu dem Master, von dem der Stand kam: Ende des Verbunds oder anderer Master löscht sie.
    const masterId = this.istSlave(k) ? k.masterId : undefined;
    if (this.fehler !== undefined && this.fehlerMasterId !== masterId) this.fehler = undefined;
    if (this.verworfen && this.verworfenMasterId !== masterId) this.verworfen = undefined;
    this.melde();
  }

  private aufAngemeldet(): void {
    if (this.gestoppt) return;
    this.verbindungVorbei();
    this.gewarnt.clear();
    this.starteAbo();
    this.melde();
  }

  private aufDaten(n: DatenZeile): void {
    if (this.gestoppt || (n.t !== 'stand' && n.t !== 'aenderung')) return;
    const k = this.client.kopplung();
    if (!this.istSlave(k)) return; // ohne Abo schickt der Master nichts; Rolle Master folgt nie (E29)
    this.antwortDa = true;
    this.stoppeAboZeitgeber();
    const masterName = this.masterName(k);
    const p = pruefeStand(n);
    let show: Show | null = null;
    let feld = p.ok ? null : p.grund;
    if (p.ok && p.wert.show) {
      try {
        show = migrateShow(p.wert.show);
      } catch {
        feld = 'show';
      }
    }
    if (!p.ok || feld !== null) {
      const f = feld ?? 'unbekannt';
      this.verworfen = { grund: f, seit: this.uhr.jetzt() };
      this.verworfenMasterId = k.masterId;
      const schluessel = `${n.t}/${f}`;
      if (!this.gewarnt.has(schluessel)) {
        this.gewarnt.add(schluessel);
        this.log('warn', `Verbund: Show-Daten von „${masterName}“ verworfen (${n.t}, Feld ${f}).`);
      }
      this.melde();
      return;
    }
    const w = p.wert;
    this.verworfen = undefined;
    const stand: MasterStand = {
      masterId: k.masterId,
      masterName,
      epoche: w.epoche,
      folge: w.folge,
      schluessel: w.schluessel,
      show,
      ...(show ? {} : { grund: w.grund }),
      mitDokument: [...w.mitDokument],
      empfangenAm: this.uhr.jetzt(),
    };
    // Ein älterer Stand derselben Epoche (verspäteter Rest) verdrängt den neueren nicht aus der Anzeige.
    if (!this.letzter || !this.istAelter(stand, this.letzter)) this.letzter = stand;
    if (!stand.show) {
      // Nichts mehr anzuwenden: ein Stand ohne Show löscht `fehler` und beendet die Versuche (16.2).
      this.fehler = undefined;
      this.beendeVersuche();
    } else if (this.istNeu(stand)) {
      this.setzeZiel(stand as MitShow, null, false);
    }
    this.melde();
  }

  // ── Abo ─────────────────────────────────────────────────────────────────────

  /** Einmal je Verbindung, nur wenn das Tool folgt, verbunden ist und Rolle Slave mit Kopplung hat. */
  private starteAbo(): void {
    if (this.gestoppt || this.aboInDieserVerbindung || !this.handler) return;
    if (this.client.zustand().art !== 'verbunden' || !this.istSlave(this.client.kopplung())) return;
    this.aboInDieserVerbindung = true;
    this.sendeAbo();
    this.antwortZeitgeber = this.uhr.setTimeout(() => {
      this.antwortZeitgeber = null;
      this.fristAbgelaufen = true;
      this.melde();
    }, this.f.antwortMs);
  }

  private sendeAbo(): void {
    // Die Zeile kommt aus kodiereAbo (eine Quelle für das Format); sende() nimmt ein Objekt.
    this.client.sende(JSON.parse(kodiereAbo()) as DatenZeile);
    this.wiederholZeitgeber = this.uhr.setTimeout(() => {
      this.wiederholZeitgeber = null;
      if (this.gestoppt || this.antwortDa || this.client.zustand().art !== 'verbunden') return;
      if (!this.istSlave(this.client.kopplung())) return;
      this.sendeAbo();
    }, this.f.aboWiederholMs);
  }

  private stoppeAboZeitgeber(): void {
    if (this.antwortZeitgeber !== null) this.uhr.clearTimeout(this.antwortZeitgeber);
    if (this.wiederholZeitgeber !== null) this.uhr.clearTimeout(this.wiederholZeitgeber);
    this.antwortZeitgeber = null;
    this.wiederholZeitgeber = null;
  }

  /** Ende der Verbindung bzw. neue Anmeldung: alles, was zu EINER Verbindung gehört, zurücksetzen. */
  private verbindungVorbei(): void {
    this.stoppeAboZeitgeber();
    this.letzter = null;
    this.verworfen = undefined; // ein verworfener Stand gehört zu EINER Verbindung
    this.antwortDa = false;
    this.aboInDieserVerbindung = false;
    this.fristAbgelaufen = false;
  }

  // ── Anwenden ────────────────────────────────────────────────────────────────

  private wendeVorratAn(): void {
    if (this.vorratErledigt || !this.gestartet || !this.handler) return;
    this.vorratErledigt = true;
    const v = this.vorrat;
    this.vorrat = null;
    if (!v || !v.show) return;
    const live = this.ziel; // ein Live-Stand, der vor der Registrierung kam
    this.setzeZiel(v as MitShow, false, true);
    if (live && this.istNeu(live.stand)) this.setzeZiel(live.stand, null, false);
  }

  private setzeZiel(stand: MitShow, neueShow: boolean | null, ausSpeicher: boolean): void {
    this.beendeVersuche();
    this.ziel = { stand, neueShow, ausSpeicher, rest: 1 + this.f.anwendeVersuche };
    this.versuche();
  }

  private beendeVersuche(): void {
    if (this.versuchZeitgeber !== null) this.uhr.clearTimeout(this.versuchZeitgeber);
    this.versuchZeitgeber = null;
    this.ziel = null;
  }

  private versuche(): void {
    const z = this.ziel;
    const h = this.handler;
    if (!z || !h || this.gestoppt || this.versuchZeitgeber !== null) return;
    if (z.neueShow === null) z.neueShow = this.istNeueShow(z.stand);
    z.rest--;
    try {
      h.anwenden(z.stand, z.neueShow);
    } catch (e) {
      const grund = grundAus(e);
      const erster = this.fehler !== grund;
      this.fehler = grund;
      this.fehlerMasterId = z.stand.masterId;
      if (z.rest > 0) {
        if (erster) this.log('warn', `Verbund: Show vom Master „${z.stand.masterName}“ nicht übernommen (${grund}), neuer Versuch in 1 s.`);
        this.versuchZeitgeber = this.uhr.setTimeout(() => {
          this.versuchZeitgeber = null;
          this.versuche();
          this.melde();
        }, this.f.anwendePauseMs);
      } else {
        this.log('warn', `Verbund: Show vom Master „${z.stand.masterName}“ nicht übernommen (${grund}), weiter erst mit dem nächsten Stand.`);
        this.ziel = null;
      }
      return;
    }
    this.ziel = null;
    this.angewendet = z.stand;
    this.fehler = undefined;
    // Der Showname kommt aus dem Netz: einzeilig und gekürzt ins Log (G6).
    this.log('info', `Verbund: Show „${kuerzeName(z.stand.show.name)}“ vom Master „${z.stand.masterName}“ übernommen (Stand ${z.stand.folge}${z.neueShow ? ', neue Show' : ''}).`);
    if (!z.ausSpeicher) this.schreibeSpaeter(z.stand);
  }

  /** Neu = andere Epoche oder größere Folge als der angewendete UND als der gerade versuchte Stand (13.3). */
  private istNeu(s: MasterStand): boolean {
    const neuerAls = (r: MasterStand | null): boolean =>
      r === null || r.masterId !== s.masterId || r.epoche !== s.epoche || s.folge > r.folge;
    return neuerAls(this.angewendet) && neuerAls(this.ziel?.stand ?? null);
  }

  private istAelter(s: MasterStand, r: MasterStand): boolean {
    return s.masterId === r.masterId && s.epoche === r.epoche && s.folge < r.folge;
  }

  /** neueShow: erster Stand, oder masterId bzw. schluessel weichen vom angewendeten ab (16.2). */
  private istNeueShow(s: MasterStand): boolean {
    const a = this.angewendet;
    return a === null || a.masterId !== s.masterId || a.schluessel !== s.schluessel;
  }

  // ── Zwischenspeicher: der Reihe nach, nur der neueste (16.3, G14) ────────────

  private schreibeSpaeter(s: MasterStand): void {
    if (!this.darfSchreiben) return;
    this.wartend = s;
    if (this.schreibt) return;
    this.schreibt = true;
    void (async () => {
      try {
        while (this.wartend) {
          const naechster = this.wartend;
          this.wartend = null;
          const generation = this.schreibGeneration;
          try {
            await this.speicher.schreibe(naechster);
          } catch {
            /* der Speicher meldet selbst; ein Fehler hier darf die Kette nicht beenden */
          }
          // ersetzt() kam während des Schreibens: die gerade geschriebene Datei gilt nicht mehr.
          if (generation !== this.schreibGeneration) this.speicher.loesche();
        }
      } finally {
        this.schreibt = false;
      }
    })();
  }

  // ── Hilfen ──────────────────────────────────────────────────────────────────

  private istSlave(k: KopplungInfo | null): k is KopplungInfo & { masterId: string } {
    return k !== null && k.rolle === 'slave' && typeof k.masterId === 'string' && k.masterId.length > 0;
  }

  /** ⟨M⟩: der Name aus der laufenden Anmeldung, sonst aus master-link.json. */
  private masterName(k: KopplungInfo): string {
    const z = this.client.zustand();
    return (z.art === 'verbunden' && z.masterName) || k.masterName || 'Master';
  }

  private mitStand(masterName: string): {
    masterName: string;
    angewendet: MasterStand | null;
    fehler?: string;
    verworfen?: { grund: string; seit: number };
  } {
    return {
      masterName,
      angewendet: this.angewendet,
      ...(this.fehler !== undefined ? { fehler: this.fehler } : {}),
      ...(this.verworfen ? { verworfen: { ...this.verworfen } } : {}),
    };
  }

  private melde(): void {
    if (this.gestoppt) return;
    const d = this.daten();
    // Die Rolle gehört dazu: aus und master zeigen beide „einzelplatz“, für ein Tool (Launcher-Wahl, 17.4) ist es ein Wechsel.
    const s = `${this.client.kopplung()?.rolle ?? ''}|${signatur(d)}`;
    if (s === this.gemeldet) return;
    this.gemeldet = s;
    this.sicher('wechsel', () => this.emit('wechsel', d));
    this.sicher('beiWechsel', () => this.handler?.beiWechsel?.(d));
  }

  /** Ein werfender Zuhörer darf die Zustandsmaschine nicht treffen; je Meldungswechsel eine Logzeile. */
  private sicher(name: string, f: () => void): void {
    try {
      f();
    } catch (e) {
      const schluessel = `${name}/${grundAus(e)}`;
      if (schluessel === this.wurfGeloggt) return;
      this.wurfGeloggt = schluessel;
      this.log('warn', `Verbund: Zuhörer von „${name}“ warf (${grundAus(e)}).`);
    }
  }

  private log(stufe: 'info' | 'warn', t: string): void {
    try {
      this.logFn(stufe, t);
    } catch {
      /* Logging darf nie werfen */
    }
  }
}
