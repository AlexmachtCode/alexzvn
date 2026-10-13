import { createHash, randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import {
  antwortFassung, GRENZEN, kodiereStand, kuerzeName, SHOW_FASSUNG, zeilenBytes,
  type AboInhalt, type DatenGrund, type SendeErgebnis, type StandInhalt, type TeilnehmerDaten,
} from '@jm/master-link';
import { showFuerVerbund, type Show } from '@jm/show';

// Verteiler der Show-Daten am Master (Master-Link Teil 2b, Release 2, Spec 13.1–13.4, 13.6, 15.1, 15.2, 15.6) — OHNE
// Electron, per tsx getestet (test/verteiler.test.ts). Quelle ist die offene Show des Launchers, wie sie in der Datei
// steht (der iveo-Kern meldet sie über meldeShow). Die MasterRolle reicht die Server-Ereignisse daten/getrennt/entstaut
// herein und startet bzw. stoppt ihn mit der Rolle (neue Epoche je Start). Er schreibt nie zurück und liest nie ein Token.

/** Was der Verteiler vom Server braucht: Senden an eine Sitzung (Rückdruck: 'gestaut', Sitzung zu: 'weg'). */
export interface VerteilerServer {
  sendeDaten(sitzung: number, zeile: string): SendeErgebnis;
}

export interface VerteilerAbhaengigkeiten {
  log(stufe: 'info' | 'warn', text: string): void;
  /** Anzeigename eines gekoppelten Rechners für die Logzeilen. */
  rechnerName(rechnerId: string): string;
  /** Vorgabe crypto.randomUUID (Spec 13.3). */
  neueEpoche?: () => string;
  /** Vorgabe path.resolve (Schlüssel der Show, 2a-Spec 4.7). */
  aufloesen?: (p: string) => string;
  /** Vorgabe Date.now — nur für die Anzeige „Stand hh:mm“ im Verbund-Modal am Master. */
  jetzt?: () => number;
  /** Abos oder Stand geändert: das Verbund-Modal neu melden. */
  beiAenderung?: () => void;
}

/** Stand fürs Verbund-Modal (Spec 15.5). Alles null, solange der Verteiler nicht läuft. */
export interface VerteilerStand {
  grund: DatenGrund | null;
  showName: string | null;
  dateiName: string | null;
  verteiltAm: number | null;
  groesseKiB: number | null;
  epoche: string | null;
  folge: number | null;
  abos: { sitzung: number; rechnerId: string; appId: string }[];
}

/**
 * Schlüssel der Show am Master (Spec 13.1): die ersten 16 Hex-Zeichen von SHA-256 über den mit `path.resolve`
 * normalisierten, kleingeschriebenen Pfad. Dieselbe Formel wie der Gedächtnis-Schlüssel des Rundowns (2a-Spec 4.7).
 */
export function verbundSchluessel(pfad: string, aufloesen: (p: string) => string = resolve): string {
  return createHash('sha256').update(aufloesen(pfad).toLowerCase()).digest('hex').slice(0, 16);
}

/** Inhalt eines Stands ohne Fassung, Epoche und Folge. */
interface Inhalt {
  schluessel: string | null;
  show: Show | null;
  grund?: DatenGrund;
  mitDokument: string[];
}

interface Aktuell {
  inhalt: Inhalt;
  folge: number;
  /** Serialisierte Form von schluessel, show, grund, mitDokument (Spec 13.3). */
  vergleich: string;
  /** Fertige Zeilen je `t:fassung`: einmal serialisiert, an alle Abos dieselbe Zeichenkette (Spec 13.6). */
  zeilen: Map<string, string>;
  verteiltAm: number;
  showName: string | null;
  dateiName: string | null;
  groesseKiB: number | null;
}

interface Abo {
  sitzung: number;
  rechnerId: string;
  appId: string;
  dieserRechner: boolean;
  fassung: number;
  /** Epoche und Folge des zuletzt an diese Sitzung gesendeten Stands (Spec 15.2). */
  gesendet: { epoche: string; folge: number } | null;
  gestaut: boolean;
}

export class Verteiler {
  private readonly d: VerteilerAbhaengigkeiten;
  private server: VerteilerServer | null = null;
  private epoche: string | null = null;
  private aktuell: Aktuell | null = null;
  /** Die zuletzt gemeldete offene Show — auch ohne laufende Rolle gemerkt (Start der Rolle verteilt sie). */
  private quelle: { pfad: string; show: Show | null } | null = null;
  private readonly abos = new Map<number, Abo>();
  /** Sitzungen eines Launchers, deren ignoriertes Abo schon im Log steht (E13: einmal je Sitzung). */
  private readonly launcherGeloggt = new Set<number>();
  /** Rechner, deren Abo-Grenze schon im Log steht (Spec 15.6: einmal je Rechner, bis wieder Platz ist). */
  private readonly grenzeGeloggt = new Set<string>();

  constructor(d: VerteilerAbhaengigkeiten) {
    this.d = d;
  }

  /** Start der Rolle Master: neue Epoche, Abos leer, Stand aus der gemerkten Show (sonst keine-show). */
  starte(server: VerteilerServer): void {
    this.server = server;
    this.epoche = (this.d.neueEpoche ?? randomUUID)();
    this.aktuell = null;
    this.leere();
    this.aktualisiere();
  }

  /** Ende der Rolle: Abos leer, es geht nichts mehr hinaus. Die gemeldete Show bleibt gemerkt. */
  stoppe(): void {
    this.server = null;
    this.epoche = null;
    this.aktuell = null;
    this.leere();
  }

  /** Spec 15.1: die offene Show, wie sie in der Datei steht; null = gespeichert und nicht lesbar. */
  meldeShow(pfad: string, show: Show | null): void {
    this.quelle = { pfad, show };
    this.aktualisiere();
  }

  /** Spec 15.2: Abo einer angemeldeten Sitzung (Ereignis `daten` des Servers, Inhalt schon mit pruefeAbo geprüft). */
  aufAbo(t: TeilnehmerDaten, abo: AboInhalt): void {
    if (!this.server || !this.aktuell) return;
    if (t.art === 'launcher') {
      if (!this.launcherGeloggt.has(t.sitzung)) {
        this.launcherGeloggt.add(t.sitzung);
        this.d.log('info', `Verbund: Abo von ${this.wer(t)} ignoriert, ein Launcher braucht keine Show-Daten.`);
      }
      return;
    }
    let a = this.abos.get(t.sitzung);
    if (a) {
      // Wiederholtes Abo derselben Sitzung (13.3): erneut den aktuellen Stand.
      a.fassung = antwortFassung(abo.fassung);
    } else {
      if (this.abosVon(t.rechnerId) >= GRENZEN.maxAbosJeRechner) {
        if (!this.grenzeGeloggt.has(t.rechnerId)) {
          this.grenzeGeloggt.add(t.rechnerId);
          this.d.log('warn', `Verbund: ${this.d.rechnerName(t.rechnerId)} hat ${GRENZEN.maxAbosJeRechner} Abos, weitere werden nicht beantwortet.`);
        }
        return;
      }
      a = {
        sitzung: t.sitzung, rechnerId: t.rechnerId, appId: t.appId, dieserRechner: t.dieserRechner,
        fassung: antwortFassung(abo.fassung), gesendet: null, gestaut: false,
      };
      this.abos.set(t.sitzung, a);
      this.d.log('info', `Verbund: Abo von ${this.wer(t)} (${this.abos.size} Abos).`);
      this.d.beiAenderung?.();
    }
    this.sendeAn(a, 'stand');
  }

  /** Spec 13.6/15.2: Ende einer Sitzung (genau einmal je Sitzung) — trifft nur deren eigenes Abo. */
  aufGetrennt(sitzung: number): void {
    this.launcherGeloggt.delete(sitzung);
    const a = this.abos.get(sitzung);
    if (!a) return;
    this.abos.delete(sitzung);
    if (this.abosVon(a.rechnerId) < GRENZEN.maxAbosJeRechner) this.grenzeGeloggt.delete(a.rechnerId);
    this.d.beiAenderung?.();
  }

  /** E5: Nach dem Stau den neuesten Stand als aenderung, wenn er neuer ist als der zuletzt an diese Sitzung gesendete. */
  aufEntstaut(sitzung: number): void {
    const a = this.abos.get(sitzung);
    const s = this.aktuell;
    if (!a || !s || this.epoche === null) return;
    a.gestaut = false;
    const neuer = a.gesendet === null || a.gesendet.epoche !== this.epoche || a.gesendet.folge < s.folge;
    if (neuer) this.sendeAn(a, 'aenderung');
  }

  hatAbo(sitzung: number): boolean {
    return this.abos.has(sitzung);
  }

  /** k der RELOAD-Logzeile (Spec 15.6): Abos von Tools anderer Rechner. */
  abosAndererRechner(): number {
    let k = 0;
    for (const a of this.abos.values()) if (!a.dieserRechner) k++;
    return k;
  }

  stand(): VerteilerStand {
    const s = this.aktuell;
    return {
      grund: s?.inhalt.grund ?? null,
      showName: s?.showName ?? null,
      dateiName: s?.dateiName ?? null,
      verteiltAm: s?.verteiltAm ?? null,
      groesseKiB: s?.groesseKiB ?? null,
      epoche: this.epoche,
      folge: s?.folge ?? null,
      abos: [...this.abos.values()].map((a) => ({ sitzung: a.sitzung, rechnerId: a.rechnerId, appId: a.appId })),
    };
  }

  private leere(): void {
    this.abos.clear();
    this.launcherGeloggt.clear();
    this.grenzeGeloggt.clear();
  }

  private wer(t: { rechnerId: string; appId: string }): string {
    return `${this.d.rechnerName(t.rechnerId)}/${t.appId}`;
  }

  private abosVon(rechnerId: string): number {
    let n = 0;
    for (const a of this.abos.values()) if (a.rechnerId === rechnerId) n++;
    return n;
  }

  /** Spec 13.3: neuer Stand nur, wenn sich schluessel, show, grund oder mitDokument unterscheiden; dann an alle Abos. */
  private aktualisiere(): void {
    if (!this.server || this.epoche === null) return;
    const folge = this.aktuell ? this.aktuell.folge + 1 : 0;
    const n = this.bilde(folge);
    if (this.aktuell && this.aktuell.vergleich === n.vergleich) {
      // Gleicher Vergleich, keine neue Folge (13.3) — aber die Anzeige (Modal, Log) zieht nach, z. B. zu-gross bleibt zu-gross.
      const s = this.aktuell;
      if (s.showName !== n.showName || s.dateiName !== n.dateiName || s.groesseKiB !== n.groesseKiB) {
        s.showName = n.showName;
        s.dateiName = n.dateiName;
        s.groesseKiB = n.groesseKiB;
        s.verteiltAm = (this.d.jetzt ?? Date.now)();
        if (s.inhalt.grund === 'zu-gross') this.logNeuerStand(n.lokal);
        this.d.beiAenderung?.();
      }
      return;
    }
    this.aktuell = { ...n, folge, zeilen: new Map(), verteiltAm: (this.d.jetzt ?? Date.now)() };
    this.logNeuerStand(n.lokal);
    for (const a of this.abos.values()) {
      // Eine gestaute Sitzung bekommt nach entstaut den neuesten Stand (E5), nicht jeden Zwischenstand.
      if (!a.gestaut) this.sendeAn(a, 'aenderung');
    }
    this.d.beiAenderung?.();
  }

  private bilde(folge: number): Omit<Aktuell, 'folge' | 'zeilen' | 'verteiltAm'> & { lokal: string[] } {
    const q = this.quelle;
    const fertig = (inhalt: Inhalt, x: { showName?: string | null; dateiName?: string | null; groesseKiB?: number | null; lokal?: string[] } = {}) => ({
      inhalt,
      vergleich: JSON.stringify([inhalt.schluessel, inhalt.show, inhalt.grund ?? null, inhalt.mitDokument]),
      showName: x.showName ?? null,
      dateiName: x.dateiName ?? null,
      groesseKiB: x.groesseKiB ?? null,
      lokal: x.lokal ?? [],
    });
    if (!q) return fertig({ schluessel: null, show: null, grund: 'keine-show', mitDokument: [] });
    const schluessel = verbundSchluessel(q.pfad, this.d.aufloesen);
    const dateiName = kuerzeName(basename(q.pfad));
    if (!q.show) return fertig({ schluessel, show: null, grund: 'nicht-lesbar', mitDokument: [] }, { dateiName });
    const a = showFuerVerbund(q.show);
    const showName = kuerzeName(a.show.name);
    const voll: Inhalt = { schluessel, show: a.show, mitDokument: a.mitDokument };
    // Spec 13.4: gemessen in UTF-8-Bytes der fertigen aenderung-Zeile mit '\n' (die stand-Zeile ist 4 Byte kürzer).
    const bytes = zeilenBytes(kodiereStand('aenderung', this.standInhalt(voll, folge, SHOW_FASSUNG)));
    const groesseKiB = Math.ceil(bytes / 1024);
    if (bytes > GRENZEN.maxStandZeile) {
      return fertig({ schluessel, show: null, grund: 'zu-gross', mitDokument: a.mitDokument }, { showName, dateiName, groesseKiB });
    }
    return fertig(voll, { showName, dateiName, groesseKiB, lokal: a.lokalGeblieben });
  }

  private standInhalt(i: Inhalt, folge: number, fassung: number): StandInhalt {
    return {
      art: 'show',
      fassung,
      epoche: this.epoche ?? '',
      folge,
      schluessel: i.schluessel,
      show: i.show as unknown as Record<string, unknown> | null,
      ...(i.grund ? { grund: i.grund } : {}),
      mitDokument: i.mitDokument,
    };
  }

  private logNeuerStand(lokal: string[]): void {
    const s = this.aktuell!;
    if (s.inhalt.grund === 'zu-gross') {
      this.d.log('warn', `Verbund: Show zu groß für den Verbund (${s.groesseKiB} KiB > 900 KiB), nicht verteilt.`);
    } else if (s.inhalt.grund === 'nicht-lesbar') {
      this.d.log('warn', `Verbund: Show „${s.dateiName}“ nicht lesbar, nicht verteilt.`);
    } else if (s.inhalt.show) {
      this.d.log('info', `Verbund: Show „${s.showName}“ verteilt (Stand ${s.folge}, ${s.groesseKiB} KiB, ${this.abos.size} Abos). `
        + `Lokal geblieben: ${lokal.length ? lokal.map(kuerzeName).join(', ') : 'nichts'}.`);
    }
  }

  /** Fertige Zeile je Typ und Fassung, einmal serialisiert. */
  private zeile(t: 'stand' | 'aenderung', fassung: number): string {
    const s = this.aktuell!;
    const k = `${t}:${fassung}`;
    let z = s.zeilen.get(k);
    if (z === undefined) {
      z = kodiereStand(t, this.standInhalt(s.inhalt, s.folge, fassung));
      s.zeilen.set(k, z);
    }
    return z;
  }

  private sendeAn(a: Abo, t: 'stand' | 'aenderung'): void {
    const s = this.aktuell;
    const server = this.server;
    if (!s || !server || this.epoche === null) return;
    const r = server.sendeDaten(a.sitzung, this.zeile(t, a.fassung));
    if (r === 'gesendet') {
      a.gesendet = { epoche: this.epoche, folge: s.folge };
      a.gestaut = false;
    } else if (r === 'gestaut') {
      if (!a.gestaut) {
        a.gestaut = true;
        this.d.log('warn', `Verbund: Sendung an ${this.wer(a)} gestaut, der neueste Stand folgt danach.`);
      }
    } else {
      // Sitzung schon zu: Abo weg (ihr getrennt kommt ebenfalls und findet nichts mehr).
      this.abos.delete(a.sitzung);
      if (this.abosVon(a.rechnerId) < GRENZEN.maxAbosJeRechner) this.grenzeGeloggt.delete(a.rechnerId);
      this.d.beiAenderung?.();
    }
  }
}
