// Presence-Logik OHNE Netz und OHNE Electron — damit test/selftest.ts sie per
// node --experimental-strip-types pruefen kann (keine Laufzeit-Importe hier!).
// Master-Link Teil 1 (Spec 5.2): Feld `verbund` = Zustand des Master-Links im Tool;
// es gehoert zur Signatur, damit jeder Zustandswechsel die Anzeige erreicht.

export interface Beat {
  appId?: string;
  name?: string;
  version?: string;
  pid?: number;
  servicePort?: number;
  logDir?: string;
  event?: 'hello' | 'beat' | 'bye';
  lastCrash?: { kind: string; at: string } | null;
  verbund?: unknown;
}

export interface PresenceZeile {
  appId: string;
  name: string;
  version: string;
  pid: number;
  servicePort?: number;
  running: boolean;
  lastSeen: number;
  lastCrash: { kind: string; at: string } | null;
  verbund?: string;
}

interface Eintrag {
  appId: string;
  name: string;
  version: string;
  pid: number;
  servicePort?: number;
  logDir?: string;
  lastSeen: number;
  stopped: boolean;
  lastCrash: { kind: string; at: string } | null;
  verbund?: string;
}

const VERBUND = /^(aus|sucht|verbindet|verbunden|fehler:[a-z-]+)$/;

export function gueltigerVerbund(v: unknown): string | undefined {
  return typeof v === 'string' && VERBUND.test(v) ? v : undefined;
}

export class PresenceStore {
  private readonly eintraege = new Map<string, Eintrag>();
  private signatur = '';
  private readonly melde: () => void;
  private readonly jetzt: () => number;
  private readonly staleMs: number;

  constructor(melde: () => void, jetzt: () => number = Date.now, staleMs = 25_000) {
    this.melde = melde;
    this.jetzt = jetzt;
    this.staleMs = staleMs;
  }

  private laeuft(e: Eintrag): boolean {
    return !e.stopped && this.jetzt() - e.lastSeen < this.staleMs;
  }

  snapshot(): PresenceZeile[] {
    return [...this.eintraege.values()]
      .map((e) => ({
        appId: e.appId,
        name: e.name,
        version: e.version,
        pid: e.pid,
        servicePort: e.servicePort,
        running: this.laeuft(e),
        lastSeen: e.lastSeen,
        lastCrash: e.lastCrash,
        verbund: e.verbund,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Meldet nur, wenn sich laufende Tools, ihre Version ODER ihr Verbund-Zustand geaendert haben. */
  pruefe(): void {
    const sig = this.snapshot()
      .filter((r) => r.running)
      .map((r) => `${r.appId}@${r.version}#${r.verbund ?? '-'}`)
      .join(',');
    if (sig !== this.signatur) {
      this.signatur = sig;
      this.melde();
    }
  }

  verarbeite(beat: Beat): void {
    if (!beat.appId) return;
    const prev = this.eintraege.get(beat.appId);
    if (beat.event === 'bye') {
      if (prev) {
        prev.stopped = true;
        prev.lastSeen = this.jetzt();
      }
      this.pruefe();
      return;
    }
    this.eintraege.set(beat.appId, {
      appId: beat.appId,
      name: beat.name ?? prev?.name ?? beat.appId,
      version: beat.version ?? prev?.version ?? '?',
      pid: beat.pid ?? prev?.pid ?? 0,
      servicePort: beat.servicePort ?? prev?.servicePort,
      logDir: beat.logDir ?? prev?.logDir,
      lastSeen: this.jetzt(),
      stopped: false,
      lastCrash: beat.lastCrash ?? prev?.lastCrash ?? null,
      // Bewusst NICHT aus prev: ein Beat ohne Feld stammt von einem Tool ohne Master-Link.
      verbund: gueltigerVerbund(beat.verbund),
    });
    this.pruefe();
  }

  logQuellen(): { appId: string; name: string; logDir: string }[] {
    return [...this.eintraege.values()]
      .filter((e): e is Eintrag & { logDir: string } => Boolean(e.logDir))
      .map((e) => ({ appId: e.appId, name: e.name, logDir: e.logDir }));
  }
}
