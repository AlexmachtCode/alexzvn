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
  private schliessend = false;

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
    return !this.beendet && !this.schliessend;
  }

  /**
   * Teil 2b (Spec 13.5): eine Zeile entnehmen, ausgeben, erst dann die nächste entnehmen. Die Grenze gilt so je Zeile —
   * hebt der Zuhörer von 'angemeldet' sie an, gilt für die nächste Zeile desselben Stücks schon 1 MiB.
   */
  private aufDaten(d: Buffer): void {
    if (this.beendet || this.schliessend) return;
    this.leser.fuettere(d);
    for (;;) {
      if (this.beendet || this.schliessend) return;
      let zeile: string | null;
      try {
        zeile = this.leser.naechste();
      } catch {
        this.brich();
        return;
      }
      if (zeile === null) return;
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

  /**
   * Teil 2b (Spec 13.6): true, wenn die Zeile in den Schreibpuffer ging; false, wenn nichts hinausging (geschlossen,
   * schließend oder zerstört). Ein Puffer über der Hochwassermarke ist kein false — Rückdruck misst der Server selbst
   * über socket.writableLength (MasterLinkServer.sendeDaten).
   */
  sende(n: Nachricht): boolean {
    return this.schreibe(kodiere(n));
  }

  /** Teil 2b (Spec 13.6): eine fertige Zeile (kodiereStand) — genau ein '\n', am Ende; sonst wirft sie (Programmfehler). */
  sendeZeile(zeile: string): boolean {
    if (zeile.indexOf('\n') !== zeile.length - 1) throw new Error('sendeZeile: genau eine Zeile mit \\n am Ende erwartet');
    return this.schreibe(zeile);
  }

  private schreibe(zeile: string): boolean {
    if (this.beendet || this.schliessend || this.socket.destroyed) return false;
    this.socket.write(zeile);
    return true;
  }

  setzeGrenze(grenze: number): void {
    this.leser.setzeGrenze(grenze);
  }

  /**
   * Gepufferte Zeilen (z. B. 'abgelehnt') gehen noch raus; spätestens nach 200 ms ist zu.
   * Ab dem Aufruf ist `offen` false, eingehende Zeilen (auch der Rest des laufenden Chunks) werden
   * verworfen und `sende()` tut nichts. Mehrfaches Aufrufen ist harmlos.
   */
  schliesse(): void {
    if (this.schliessend) return;
    this.schliessend = true;
    if (this.socket.destroyed) return;
    this.socket.end();
    const t = setTimeout(() => this.socket.destroy(), 200);
    t.unref?.();
  }
}
