import type { EventEmitter } from 'node:events';
import BonjourPaket from 'bonjour-service';
import type { Karte } from './adresswahl';
import { kurzFingerprint } from './beweis';
import { PROTOKOLL } from './rahmen';

// mDNS des Master-Links (Spec 4.2, 4.5). GEMESSEN (bonjour-service 1.4.0 / multicast-dns 7.2.5):
//  - benannter Import { Bonjour } scheitert unter ESM → Default-Import, dann .Bonjour
//  - ohne `interface` wird nur über EINE Karte gesendet → eine Instanz je Karte
//  - `interface` ohne `bind` bindet an die Karten-IP → unter macOS kommt kein Multicast an
//  - ein langlebiger Browser übernimmt neue Adressen eines bekannten Dienstes NIE → je Runde neuer find()
//  - probe verwirft still eine zweite Veröffentlichung gleichen Namens → probe:false + Name aus masterId
//  - multicast-dns meldet Bind-Fehler als 'error', bonjour-service hört das nicht ab → sonst Absturz

export const DIENST_TYP = 'jmps-master';

export interface MdnsDienst {
  name: string;
  port: number;
  addresses?: string[];
  txt?: Record<string, unknown> | null;
}

export interface BonjourLike {
  publish(o: { name: string; type: string; port: number; txt: Record<string, string>; probe: boolean; disableIPv6: boolean }): unknown;
  find(o: { type: string }, onUp?: (s: MdnsDienst) => void): { stop(): void };
  unpublishAll(cb?: () => void): void;
  destroy(cb?: () => void): void;
}

export type BonjourFabrik = (o: { interface: string; bind: string }) => BonjourLike;

export function standardFabrik(log: (text: string) => void = () => {}): BonjourFabrik {
  return (o) => {
    // interface/bind gehen 1:1 an multicast-dns, stehen aber nicht im Typ ServiceConfig.
    const b = new BonjourPaket.Bonjour(
      o as unknown as Partial<BonjourPaket.ServiceConfig>,
      (e: Error) => log(`mDNS-Antwort fehlgeschlagen: ${e.message}`), // Vorgabe wirft sonst im dgram-Callback
    );
    const mdns = (b as unknown as { server: { mdns: EventEmitter } }).server.mdns;
    mdns.on('error', (e: Error) => log(`mDNS-Fehler auf ${o.interface}: ${e.message}`));
    mdns.on('warning', (e: Error) => log(`mDNS-Warnung auf ${o.interface}: ${e.message}`));
    return b as unknown as BonjourLike;
  };
}

export function instanzOptionen(karten: Karte[]): { interface: string; bind: '0.0.0.0' }[] {
  return karten
    .filter((k) => k.adressen.length > 0)
    .map((k) => ({ interface: k.adressen[0].adresse, bind: '0.0.0.0' as const }));
}

export function instanzName(masterId: string): string {
  return `jm-master-${masterId.replace(/-/g, '').slice(0, 8)}`;
}

/** Ein TXT-Eintrag darf 255 Byte haben (sonst läuft dns-packet still über) — nach ganzen Zeichen kürzen. */
export function kuerzeFuerTxt(text: string, maxBytes = 250): string {
  let aus = '';
  for (const z of text) {
    if (Buffer.byteLength(aus + z) > maxBytes) break;
    aus += z;
  }
  return aus;
}

export interface MasterSichtung {
  masterId: string;
  name: string;
  fpKurz: string;
  protokoll: number;
  adressen: string[];
}

function txtWert(txt: Record<string, unknown> | null | undefined, key: string): string {
  const v = txt?.[key];
  if (typeof v === 'string') return v;
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  return '';
}

export function leseSichtung(s: MdnsDienst): MasterSichtung | null {
  const masterId = txtWert(s.txt, 'id');
  if (!masterId) return null;
  const p = Number(txtWert(s.txt, 'p'));
  return {
    masterId,
    name: txtWert(s.txt, 'name') || s.name,
    fpKurz: txtWert(s.txt, 'fp'),
    protokoll: Number.isInteger(p) ? p : 0,
    adressen: (s.addresses ?? []).filter((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a)),
  };
}

export class MasterAnnonce {
  private readonly fabrik: BonjourFabrik;
  private readonly daten: { masterId: string; name: string; fp: string; port: number };
  private instanzen: BonjourLike[] = [];

  constructor(fabrik: BonjourFabrik, daten: { masterId: string; name: string; fp: string; port: number }) {
    this.fabrik = fabrik;
    this.daten = { ...daten };
  }

  starte(karten: Karte[]): void {
    for (const o of instanzOptionen(karten)) {
      const b = this.fabrik(o);
      b.publish({
        name: instanzName(this.daten.masterId),
        type: DIENST_TYP,
        port: this.daten.port,
        txt: {
          id: this.daten.masterId,
          name: kuerzeFuerTxt(this.daten.name),
          fp: kurzFingerprint(this.daten.fp),
          p: String(PROTOKOLL),
        },
        probe: false,
        disableIPv6: true,
      });
      this.instanzen.push(b);
    }
  }

  /** Neuer Name bzw. andere Karten: erst sauber abmelden (Goodbye), dann neu annoncieren. */
  async aktualisiere(karten: Karte[], name?: string): Promise<void> {
    await this.stoppe();
    if (name !== undefined) this.daten.name = name;
    this.starte(karten);
  }

  async stoppe(): Promise<void> {
    const alte = this.instanzen;
    this.instanzen = [];
    await Promise.all(
      alte.map(
        (b) =>
          new Promise<void>((fertig) => {
            let erledigt = false;
            const ende = (): void => {
              if (erledigt) return;
              erledigt = true;
              try {
                b.destroy();
              } catch {
                /* schon zu */
              }
              fertig();
            };
            const notfall = setTimeout(ende, 1000);
            try {
              b.unpublishAll(() => {
                clearTimeout(notfall);
                ende();
              });
            } catch {
              clearTimeout(notfall);
              ende();
            }
          }),
      ),
    );
  }
}

export interface SucheLike {
  runde(dauerMs: number): Promise<MasterSichtung[]>;
  setzeKarten(k: Karte[]): void;
  stoppe(): void;
}

export class MdnsSuche implements SucheLike {
  private readonly fabrik: BonjourFabrik;
  private instanzen: BonjourLike[] = [];
  private schluessel = '';

  constructor(fabrik: BonjourFabrik) {
    this.fabrik = fabrik;
  }

  setzeKarten(karten: Karte[]): void {
    const opts = instanzOptionen(karten);
    const s = JSON.stringify(opts);
    if (s === this.schluessel) return;
    this.stoppe();
    this.schluessel = s;
    this.instanzen = opts.map((o) => this.fabrik(o));
  }

  runde(dauerMs: number): Promise<MasterSichtung[]> {
    const gefunden = new Map<string, MasterSichtung>();
    const browser = this.instanzen.map((b) =>
      b.find({ type: DIENST_TYP }, (s) => {
        const z = leseSichtung(s);
        if (!z) return;
        const alt = gefunden.get(z.masterId);
        gefunden.set(z.masterId, alt ? { ...alt, adressen: [...new Set([...alt.adressen, ...z.adressen])] } : z);
      }),
    );
    return new Promise((fertig) => {
      setTimeout(() => {
        for (const br of browser) {
          try {
            br.stop();
          } catch {
            /* egal */
          }
        }
        fertig([...gefunden.values()]);
      }, dauerMs);
    });
  }

  stoppe(): void {
    for (const b of this.instanzen) {
      try {
        b.destroy();
      } catch {
        /* egal */
      }
    }
    this.instanzen = [];
    this.schluessel = '';
  }
}
