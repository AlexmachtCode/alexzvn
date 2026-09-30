import { EventEmitter } from 'node:events';
import type { TLSSocket } from 'node:tls';
import { dekodiere, kodiere, ZeilenLeser, type Nachricht } from './rahmen';

export function ohneV6Praefix(adresse: string | undefined): string {
  return (adresse ?? '').replace(/^::ffff:/, '');
}

/**
 * Ein TLS-Socket mit Zeilenrahmen. Ereignisse:
 *  - 'nachricht' (n: Nachricht)
 *  - 'unbekannt' (t: string)      — unbekannter Typ, wird ignoriert
 *  - 'ende' (fehler?: Error)       — genau einmal; Error('rahmen') bei kaputter/zu langer Zeile
 */
export class Verbindung extends EventEmitter {
  readonly socket: TLSSocket;
  readonly adresse: string;
  private readonly leser: ZeilenLeser;
  private beendet = false;

  constructor(socket: TLSSocket, grenze: number) {
    super();
    this.socket = socket;
    this.adresse = ohneV6Praefix(socket.remoteAddress);
    this.leser = new ZeilenLeser(grenze);
    socket.on('data', (d: Buffer) => this.aufDaten(d));
    socket.on('error', (e: Error) => this.beende(e));
    socket.on('close', () => this.beende());
  }

  get offen(): boolean {
    return !this.beendet;
  }

  private aufDaten(d: Buffer): void {
    if (this.beendet) return;
    let zeilen: string[];
    try {
      zeilen = this.leser.fuettere(d);
    } catch {
      this.brich();
      return;
    }
    for (const zeile of zeilen) {
      if (this.beendet) return;
      const r = dekodiere(zeile);
      if (r.art === 'kaputt') {
        this.brich();
        return;
      }
      if (r.art === 'unbekannt') this.emit('unbekannt', r.t);
      else this.emit('nachricht', r.n);
    }
  }

  private brich(): void {
    this.socket.destroy();
    this.beende(new Error('rahmen'));
  }

  private beende(fehler?: Error): void {
    if (this.beendet) return;
    this.beendet = true;
    this.emit('ende', fehler);
  }

  sende(n: Nachricht): void {
    if (!this.beendet && !this.socket.destroyed) this.socket.write(kodiere(n));
  }

  setzeGrenze(grenze: number): void {
    this.leser.setzeGrenze(grenze);
  }

  /** Gepufferte Zeilen (z. B. 'abgelehnt') gehen noch raus; spätestens nach 200 ms ist zu. */
  schliesse(): void {
    if (this.socket.destroyed) return;
    this.socket.end();
    const t = setTimeout(() => this.socket.destroy(), 200);
    t.unref?.();
  }
}
