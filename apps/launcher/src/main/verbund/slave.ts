import { networkInterfaces } from 'node:os';
import {
  fehlerText, koppele, kuerzeName, listeKarten, MASTER_PORT, MasterLinkClient, MdnsSuche, normalisiereCode, ordneKandidaten,
  standardFabrik, wirksameKarten,
  type ClientZustand, type Fristen, type KoppelErgebnis, type MasterLinkDatei, type MasterSichtung,
  type NetzwerkInterfaces, type SucheLike,
} from '@jm/master-link';
import type { GefundenerMaster, KoppelAntwort, VerbundClientStand, VerbundSlaveStand } from '@shared/types';
import { fehlerCode } from './fehlercode';

// Slave-Rolle des Launchers (Spec 3.1, 5.3): eigener Client als Teilnehmer „launcher“,
// Koppeln per Code, Liste gefundener Master. Schreibt die gemeinsame master-link.json.

export interface SlaveAbhaengigkeiten {
  dateiPfad: string;
  suiteVersion: string;
  datei: () => MasterLinkDatei;
  /** Schreibt die gemeinsame master-link.json. WIRFT bei einem Fehler (auch bei gesperrter Datei): nie „gekoppelt“ melden, ohne zu speichern. */
  schreibeDatei: (d: MasterLinkDatei) => void;
  beiAenderung: () => void;
  log: (stufe: 'info' | 'warn', text: string) => void;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Suche des Clients (Vorgabe echtes mDNS; null = keine). */
  suche?: SucheLike | null;
  /** Suche für die Liste „gefundene Master“ (Vorgabe echtes mDNS; null = keine). */
  listenSuche?: SucheLike | null;
  /** Nur Tests: Takt der Listensuche (Vorgabe 5000 ms). */
  suchTaktMs?: number;
}

export function teileAdresse(eingabe: string): { host: string; port: number } | null {
  const t = eingabe.trim();
  if (!t) return null;
  const m = /^([^:\s]+)(?::(\d{1,5}))?$/.exec(t);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : MASTER_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

/** Texte beim Koppeln (Spec 9.2). */
export function koppelText(r: Exclude<KoppelErgebnis, { ok: true }>, masterName: string, adresse: string): string {
  switch (r.art) {
    case 'abgelehnt':
      switch (r.grund) {
        case 'code-falsch': return `Code stimmt nicht, noch ${r.rest ?? 0} Versuche.`;
        case 'code-ungueltig': return 'Code abgelaufen oder verbraucht. Am Master einen neuen Code holen.';
        case 'keine-kopplung-offen': return 'Am Master zuerst „Rechner koppeln“ öffnen.';
        case 'rechner-id': return 'Dieser Rechner hat dieselbe Kennung wie der Master (Ordner kopiert?). Kopplungsdatei zurücksetzen.';
        case 'protokoll': return fehlerText('protokoll', { masterName });
        default: return `Der Master hat abgelehnt (${r.grund}).`;
      }
    case 'master-beweis':
      return 'Der Master konnte den Code nicht bestätigen, möglicherweise ein fremdes Gerät. Nichts gespeichert.';
    case 'frist':
      return 'Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.';
    case 'verbindung':
      return fehlerText(r.code, { masterName, adresse, errCode: r.errCode });
    case 'abgebrochen':
      return 'Koppeln abgebrochen. Nichts gespeichert.';
  }
}

function clientStand(z: ClientZustand): VerbundClientStand {
  switch (z.art) {
    case 'verbunden': return { art: 'verbunden', adresse: z.adresse, seit: z.seit };
    case 'verbindet': return { art: 'verbindet', adresse: z.adresse };
    case 'fehler': return { art: 'fehler', code: z.code, text: z.text, errCode: z.errCode };
    default: return { art: z.art };
  }
}

export class SlaveRolle {
  private readonly d: SlaveAbhaengigkeiten;
  private readonly client: MasterLinkClient;
  private readonly listenSuche: SucheLike | null;
  private gefunden: GefundenerMaster[] = [];
  private vorige: MasterSichtung[] = [];
  private suchZeitgeber: ReturnType<typeof setInterval> | null = null;
  private sucheLaeuft = false;
  private koppelAbbruch: AbortController | null = null;
  private koppeltGerade = false;
  private koppelZiel: string | null = null;
  /** Letzter geloggter Fehler der Such-Runde: dieselbe Meldung steht nicht alle 5 s im Log. */
  private letzterSuchFehler: string | null = null;

  constructor(d: SlaveAbhaengigkeiten) {
    this.d = d;
    this.client = new MasterLinkClient({
      dateiPfad: d.dateiPfad,
      teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: d.suiteVersion, pid: process.pid },
      fristen: d.fristen,
      netzwerkKarten: d.netzwerkKarten,
      suche: d.suche,
      log: d.log,
    });
    this.client.on('zustand', () => d.beiAenderung());
    this.client.on('angemeldet', (a: { adresse: string; adressen: string[] }) => this.merkeAdressen(a));
    this.listenSuche = d.listenSuche === undefined ? new MdnsSuche(standardFabrik((t) => d.log('warn', t))) : d.listenSuche;
  }

  starte(): void {
    this.client.starte();
  }

  async stoppe(): Promise<void> {
    this.stoppeSuche();
    this.koppelAbbruch?.abort();
    await this.client.stoppe();
    this.listenSuche?.stoppe();
  }

  /** Liste „gefundene Master“ — nur solange das Modal offen ist. */
  starteSuche(): void {
    if (this.suchZeitgeber || !this.listenSuche) return;
    const runde = async (): Promise<void> => {
      if (this.sucheLaeuft || !this.listenSuche) return;
      this.sucheLaeuft = true;
      try {
        const alle = listeKarten((this.d.netzwerkKarten ?? networkInterfaces)());
        const gewaehlt = this.d.datei().netzwerk.karte;
        this.listenSuche.setzeKarten(wirksameKarten(alle, gewaehlt).karten);
        const jetzt = await this.listenSuche.runde(1500);
        // Sichtbar bleibt, wer in einer der letzten zwei Runden geantwortet hat.
        const zusammen = new Map<string, MasterSichtung>();
        for (const s of [...this.vorige, ...jetzt]) zusammen.set(s.masterId, s);
        this.vorige = jetzt;
        const neu = [...zusammen.values()].map((s) => ({
          masterId: s.masterId,
          name: s.name,
          fpKurz: s.fpKurz,
          adressen: ordneKandidaten(s.adressen, alle, gewaehlt),
        }));
        if (JSON.stringify(neu) !== JSON.stringify(this.gefunden)) {
          this.gefunden = neu;
          this.d.beiAenderung();
        }
        this.letzterSuchFehler = null;
      } catch (e) {
        // Eine werfende Runde (Kartenliste, Bonjour-Fabrik) ist keine unbehandelte Ablehnung im Main; geloggt wird nur ein Wechsel.
        const code = fehlerCode(e);
        if (code !== this.letzterSuchFehler) {
          this.letzterSuchFehler = code;
          this.d.log('warn', `Master-Suche fehlgeschlagen (${code}).`);
        }
      } finally {
        this.sucheLaeuft = false;
      }
    };
    void runde();
    this.suchZeitgeber = setInterval(() => void runde(), this.d.suchTaktMs ?? 5000);
  }

  stoppeSuche(): void {
    if (this.suchZeitgeber) clearInterval(this.suchZeitgeber);
    this.suchZeitgeber = null;
  }

  /** Spec 3.1: Verbindung erst, wenn der Code lokal gültig ist; Ergebnis nur bei Erfolg speichern. */
  async koppele(adresseEingabe: string, codeEingabe: string): Promise<KoppelAntwort> {
    const c = normalisiereCode(codeEingabe);
    if (!c.ok) {
      return {
        ok: false,
        text: c.grund === 'zeichen'
          ? `Das Zeichen ${c.zeichen} kommt im Code nicht vor.`
          : `Der Code hat 10 Zeichen, eingegeben: ${c.laenge}.`,
      };
    }
    const ziel = teileAdresse(adresseEingabe);
    if (!ziel) return { ok: false, text: 'Bitte einen gefundenen Master wählen oder eine Adresse eintragen.' };
    this.koppelAbbruch?.abort();
    const ctrl = new AbortController();
    this.koppelAbbruch = ctrl;
    const gesehen = this.gefunden.find((g) => g.adressen.includes(ziel.host));
    // Kopf „Koppeln mit ⟨Name⟩…“ (Spec 5.4) schon beim ERSTEN Koppeln: Name aus mDNS, sonst die Adresse.
    this.koppelZiel = kuerzeName(gesehen?.name ?? ziel.host);
    this.koppeltGerade = true;
    this.d.beiAenderung();
    try {
      const d = this.d.datei();
      const r = await koppele({
        adresse: ziel.host,
        port: ziel.port,
        code: c.code,
        rechner: d.rechner,
        fristen: this.d.fristen,
        signal: ctrl.signal,
        mdnsGesehen: gesehen !== undefined,
        // Spec 4.5: eine von Hand eingetragene Adresse (nicht aus mDNS) wird beim Koppeln die feste Adresse.
        festeAdresse: gesehen ? (d.kopplung?.festeAdresse ?? null) : ziel.host,
      });
      if (!r.ok) return { ok: false, text: koppelText(r, gesehen?.name ?? ziel.host, ziel.host) };
      // Der Master-Name kommt aus der 'gekoppelt'-Zeile (bis 4 KiB, Zeilenumbrüche möglich): vor Speichern, Log und Anzeige kürzen.
      const masterName = kuerzeName(r.masterName);
      const kopplung = { ...r.kopplung, masterName: kuerzeName(r.kopplung.masterName) };
      try {
        this.d.schreibeDatei({ ...this.d.datei(), rolle: 'slave', kopplung });
      } catch (e) {
        // Nie „gekoppelt“ melden, ohne zu speichern: der Master führt diesen Rechner zwar schon im Verbund, aber hier
        // wäre die Kopplung nach dem Neustart weg. Verbindung zu, nichts übernehmen, ehrlich ablehnen (Spec 10).
        const code = fehlerCode(e);
        r.verbindung.schliesse();
        this.d.log('warn', `Kopplung nicht gespeichert (${code}).`);
        return { ok: false, text: `Kopplung konnte auf diesem Rechner nicht gespeichert werden (${code}).` };
      }
      this.client.uebernehme(r.verbindung, kopplung, masterName);
      this.d.log('info', `Mit Master „${masterName}“ gekoppelt.`);
      return { ok: true };
    } finally {
      // Nur der AKTUELLE Lauf setzt zurück: ein zweites koppele() hat das erste abgebrochen und läuft noch.
      if (this.koppelAbbruch === ctrl) {
        this.koppelAbbruch = null;
        this.koppeltGerade = false;
        this.koppelZiel = null;
        this.d.beiAenderung();
      }
    }
  }

  brecheKoppelnAb(): void {
    this.koppelAbbruch?.abort();
  }

  /** Nur bei Änderung schreiben — reine Adressnachträge trennen die Tools nicht (Spec 7.1). */
  private merkeAdressen(a: { adresse: string; adressen: string[] }): void {
    const d = this.d.datei();
    const k = d.kopplung;
    if (!k) return;
    if (k.letzteAdresse === a.adresse && JSON.stringify(k.adressen) === JSON.stringify(a.adressen)) return;
    try {
      this.d.schreibeDatei({ ...d, kopplung: { ...k, letzteAdresse: a.adresse, adressen: a.adressen } });
    } catch (e) {
      // Ein verpasster Adressnachtrag ist kein Grund, die Verbindung zu stören; er kommt mit der nächsten Anmeldung wieder.
      this.d.log('warn', `Master-Adressen nicht gespeichert (${fehlerCode(e)}).`);
    }
  }

  stand(): VerbundSlaveStand {
    const d = this.d.datei();
    return {
      gekoppelt: d.kopplung !== null,
      koppeltGerade: this.koppeltGerade,
      masterName: this.koppeltGerade ? this.koppelZiel : (d.kopplung ? kuerzeName(d.kopplung.masterName) : null),
      festeAdresse: d.kopplung?.festeAdresse ?? null,
      client: clientStand(this.client.zustand()),
      gefundeneMaster: this.gefunden,
    };
  }
}
