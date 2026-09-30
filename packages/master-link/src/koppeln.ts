import { connect } from 'node:tls';
import { randomNonce } from '@jm/auth-core';
import { derZuPem, erzeugeSchluesselpaar, fingerprintVonPem, gleicherBeweis, masterBeweis, slaveBeweis } from './beweis';
import { normalisiereCode } from './code';
import type { Kopplung } from './datei';
import { ordneEin, type FehlerCode } from './fehler';
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type Grund, type Nachricht } from './rahmen';
import { Verbindung } from './verbindung';

// Slave-Seite der Kopplung (Spec 3.3). Hier und NUR hier: TLS ohne Pin (rejectUnauthorized:false) —
// es gibt noch keinen. Den Schutz liefert der an den GESEHENEN Fingerprint gebundene Beweis
// und die HARTE Frist nach 'koppeln' (Offline-Raten braucht länger als 10 s).

export interface KoppelAnfrage {
  adresse: string;
  port?: number;
  /** Code wie eingegeben — koppele() normalisiert und prüft selbst (Spec 3.1, 3.2). */
  code: string;
  rechner: { id: string; name: string };
  fristen?: Partial<Fristen>;
  signal?: AbortSignal;
  /** Wurde der Master per mDNS gesehen? (nur für die Einordnung eines TCP-Timeouts) */
  mdnsGesehen?: boolean;
  festeAdresse?: string | null;
}

export type KoppelErgebnis =
  | { ok: true; kopplung: Kopplung; verbindung: Verbindung; masterName: string }
  | { ok: false; art: 'abgelehnt'; grund: Grund; rest?: number }
  | { ok: false; art: 'master-beweis' }
  | { ok: false; art: 'frist' }
  | { ok: false; art: 'verbindung'; code: FehlerCode; errCode?: string }
  | { ok: false; art: 'abgebrochen' };

/** errCode, wenn der Code schon lokal ungültig ist — dann gibt es keinen Socket (Spec 3.1). */
const CODE_UNGUELTIG = 'CODE_UNGUELTIG';

export function koppele(a: KoppelAnfrage): Promise<KoppelErgebnis> {
  const f: Fristen = mitFristen(a.fristen);
  const port = a.port ?? MASTER_PORT;
  if (a.signal?.aborted) return Promise.resolve({ ok: false, art: 'abgebrochen' });
  // Spec 3.1: erst mit lokal gültigem Code verbinden — auch wenn der Aufrufer nicht vorher geprüft hat.
  const pruefung = typeof a.code === 'string' ? normalisiereCode(a.code) : null;
  if (!pruefung?.ok) return Promise.resolve({ ok: false, art: 'verbindung', code: 'sonstig', errCode: CODE_UNGUELTIG });
  const code = pruefung.code;
  const paar = erzeugeSchluesselpaar();
  const nc = randomNonce();
  const rechnerName = kuerzeName(a.rechner.name);

  return new Promise<KoppelErgebnis>((fertig) => {
    let erledigt = false;
    let frist: ReturnType<typeof setTimeout> | null = null;
    let v: Verbindung | null = null;
    let fp = '';
    let zertifikat = '';
    let ns = '';
    let halloMasterId = '';

    const socket = connect({ host: a.adresse, port, rejectUnauthorized: false });

    const ende = (r: KoppelErgebnis): void => {
      if (erledigt) return;
      erledigt = true;
      if (frist) clearTimeout(frist);
      a.signal?.removeEventListener('abort', abbruch);
      if (!r.ok) {
        v?.removeAllListeners();
        socket.destroy();
      }
      fertig(r);
    };
    const abbruch = (): void => ende({ ok: false, art: 'abgebrochen' });
    const setzeFrist = (ms: number, r: KoppelErgebnis): void => {
      if (frist) clearTimeout(frist);
      frist = setTimeout(() => ende(r), ms);
    };
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (den Launcher).
    const sicher = <T extends unknown[]>(h: (...x: T) => void) => (...x: T): void => {
      try {
        h(...x);
      } catch (e) {
        ende({ ok: false, art: 'verbindung', code: 'sonstig', errCode: (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT' });
      }
    };
    a.signal?.addEventListener('abort', abbruch, { once: true });

    const tcpCode = ordneEin({ art: 'tcp-timeout' }, a.mdnsGesehen ?? false);
    setzeFrist(f.tcpMs, { ok: false, art: 'verbindung', code: tcpCode.art === 'code' ? tcpCode.code : 'nicht-gefunden' });
    socket.once('connect', () => setzeFrist(f.tlsHalloMs, { ok: false, art: 'verbindung', code: 'kein-master' }));
    socket.on('error', (e: NodeJS.ErrnoException) => {
      const o = ordneEin({ art: 'fehler', code: e.code ?? 'UNBEKANNT' }, a.mdnsGesehen ?? false);
      ende({ ok: false, art: 'verbindung', code: o.art === 'code' ? o.code : 'sonstig', errCode: e.code });
    });

    socket.once('secureConnect', sicher(() => {
      const raw = socket.getPeerCertificate(true)?.raw;
      if (!raw) {
        ende({ ok: false, art: 'verbindung', code: 'kein-master' });
        return;
      }
      zertifikat = derZuPem(raw);
      fp = fingerprintVonPem(zertifikat); // der Fingerprint, den dieser Slave TATSÄCHLICH sieht
      // Spec 6.1: vor der Anmeldung 4 KiB je Zeile — hier spricht ein noch UNGEPRÜFTES Gegenüber.
      const verbindung = new Verbindung(socket, GRENZEN.vorAnmeldung);
      v = verbindung;
      verbindung.on('ende', () => ende({ ok: false, art: 'verbindung', code: 'kein-master' }));
      verbindung.on('nachricht', sicher((n: Nachricht) => {
        if (n.t === 'hallo' && !ns) {
          ns = n.nonce;
          halloMasterId = n.masterId;
          const d = { fp, ns, nc, rechnerId: a.rechner.id, schluessel: paar.oeffentlich };
          verbindung.sende({
            t: 'koppeln',
            protokoll: PROTOKOLL,
            rechnerId: a.rechner.id,
            rechnerName,
            nonce: nc,
            schluessel: paar.oeffentlich,
            beweis: slaveBeweis(code, d),
          });
          // HART: keine eingehende Zeile verlängert diese Frist (auch nicht 'puls').
          setzeFrist(f.koppelnMs, { ok: false, art: 'frist' });
          return;
        }
        if (!ns) return;
        // Vor dem geprüften 'gekoppelt' zählt nur 'abgelehnt' — und das nur zur Anzeige.
        if (n.t === 'abgelehnt') {
          ende({ ok: false, art: 'abgelehnt', grund: n.grund, rest: n.rest });
          return;
        }
        if (n.t !== 'gekoppelt') return;
        const d = { fp, ns, nc, rechnerId: a.rechner.id, schluessel: paar.oeffentlich };
        if (n.masterId !== halloMasterId || !gleicherBeweis(masterBeweis(code, d, n.masterId), n.beweis)) {
          ende({ ok: false, art: 'master-beweis' });
          return;
        }
        verbindung.removeAllListeners();
        // Spec 3.3: nach dem geprüften 'gekoppelt' ist die Verbindung angemeldet → 1 MiB je Zeile (Spec 6.1).
        verbindung.setzeGrenze(GRENZEN.nachAnmeldung);
        ende({
          ok: true,
          masterName: n.name,
          verbindung,
          kopplung: {
            masterId: n.masterId,
            masterName: n.name,
            fingerprint: fp,
            zertifikat,
            port,
            adressen: n.adressen,
            letzteAdresse: a.adresse,
            festeAdresse: a.festeAdresse ?? null,
            schluessel: paar,
          },
        });
      }));
    }));
  });
}
