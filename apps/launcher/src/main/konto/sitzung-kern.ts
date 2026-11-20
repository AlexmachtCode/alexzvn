// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Sitzungs-Treiber (Plan 10.6, Verhalten 11.1 R1–R13; Spec 4.2, 6.1, 6.3, 14; EP2, EP23,
// EP26). Hält die Sitzung im Speicher, rechnet die Ansicht „angemeldet als …“ in jedem Zustand und prüft beim Start im
// Hintergrund: Die erste Ansicht entsteht vor jeder Netzantwort, der Start des Launchers wartet nie auf den Server (G5).
// Speicher, Uhr, Wecker, Client und Gerät sind eingespeist; die Hülle (Task 21) verdrahtet safeStorage und IPC.
// Kein electron-Import (G9). Nichts hier schreibt eine Sitzung in ein Log oder in die Ansicht (G4): token() geht nur an
// Abrufe im Main. Obergrenze 30 Tage (Spec 6.1, EP29): ab 24 h vor `exp` prüft der Treiber im Hintergrund neu; erreicht die
// Sitzung `exp` ohne neue Prüfung, endet sie ohne Anfrage. Höchstens ein Wecker, höchstens 24 h lang.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AblaufGrund, EntzugGrund, FreigabeAusgabe, KontoAnsicht, KontoStand, KontoZustand, StoerGrund, ZoomAnfrageStand,
} from '../../shared/konto';
import type { GeraetHandle, Verschluesseler } from './geraet';
import { KontoFehler, type KontoClient } from './worker-client';

export interface GespeicherteSitzung { token: string; stand: KontoStand }
export interface SitzungsUmgebung {
  jetzt(): number; client: KontoClient; geraet: GeraetHandle | null;
  speicher: { lade(): GespeicherteSitzung | null | 'unlesbar'; speichere(s: GespeicherteSitzung | null): void;
    ladeEntzug(): { grund: EntzugGrund; am: number } | null; merkeEntzug(e: { grund: EntzugGrund; am: number } | null): void };
  version: string; rechnerName: string; plattform: 'win' | 'mac'; devVariablen: string[];
  wecker(ms: number, fn: () => void): () => void; melde(a: KontoAnsicht): void;
  nachAnmeldung(s: GespeicherteSitzung, erste: boolean): void; nachStartPruefung(token: string, stand: KontoStand): void; nachAbmelden(): void;
  /** Abweichung B2: `kontoErsteAnmeldung` aus den Einstellungen (null = nie angemeldet); fehlt die Angabe, ist `erste` immer false. */
  ersteAnmeldung?(): number | null;
}
export interface SitzungsTreiber {
  start(): void; ansicht(): KontoAnsicht; token(): string | null; sitzungFuerBedarf(): Promise<string | null>;
  angemeldet(s: GespeicherteSitzung): void; abmelden(): Promise<void>; lage(): Promise<void>;
  merkeAusgabe(a: FreigabeAusgabe): void; merkeHinweis(h: KontoAnsicht['hinweise'][number]): void;
  /** Z1: Beenden des Launchers: der Wecker geht aus, danach plant der Treiber keinen mehr und prüft nichts im Hintergrund. */
  stoppe(): void;
}

/** R13: nur diese Namen erscheinen im Konto-Dialog (K31), nie Werte. */
export const DEV_VARIABLEN = ['JMPS_PROXY_KEY', 'JMPS_GITHUB_TOKEN', 'JMPS_RELEASE_PROXY', 'JMPS_IVEO_TOKEN'] as const;
/** R5: Wiederholung der Start-Prüfung nach 30 s, verdoppelt bis höchstens 5 min. */
export const WIEDERHOLUNG_START_MS = 30_000;
export const WIEDERHOLUNG_MAX_MS = 5 * 60_000;
/** R7, Abweichung B3: ein Bedarf erneuert ab 60 s vor `exp`, weil der Worker nur gültige Sitzungen erneuert (10.1, POST /konto/sitzung). */
export const ERNEUERN_VORLAUF_MS = 60_000;
/** EP29 (Spec 6.1, Obergrenze 30 Tage): ab 24 h vor `exp` prüft der Treiber in `angemeldet` im Hintergrund neu (Erneuerung). */
export const NEUPRUEFUNG_VORLAUF_MS = 24 * 3600_000;
/** EP29: ein Wecker trägt höchstens 24 h (setTimeout der Hülle höchstens 2^31 − 1 ms ≈ 24,8 Tage); zu früh geweckt, stellt er sich neu. */
export const WECKER_MAX_MS = 24 * 3600_000;
/** R11: so viele Ausgaben an Tools hält die Ansicht (dieser Lauf, ohne Token). */
export const AUSGABEN_MAX = 10;
/** OFP8: so lange nach der letzten Anmeldung mit Google erneuert der Worker ein Google-Konto (wie GOOGLE_NEU_MS in konto-kern.js). */
export const GOOGLE_NEU_MS = 90 * 24 * 3600_000;

/**
 * Z1: der Stand für die Ansicht (und damit für den Renderer) mit ausdrücklich gewählten Feldern. Was der Worker sonst noch in den
 * Stand schreibt (heute `v`, `typ`; morgen vielleicht mehr), erreicht den Renderer nie.
 */
export function standFuerAnsicht(s: KontoStand): KontoStand {
  return {
    kid: s.kid, email: s.email, name: s.name, art: s.art, stufe: s.stufe, tools: [...s.tools], events: [...s.events], zoom: s.zoom,
    zoomBis: s.zoomBis, jm: s.jm, plattform: s.plattform, gid: s.gid, iat: s.iat, exp: s.exp, kontoBis: s.kontoBis,
    angemeldetSeit: s.angemeldetSeit,
  };
}

/** Fixrunde 1 (Nr. 7): die Zoom-Anfrage für die Ansicht mit ausdrücklich gewählten Feldern (kein Rest des Worker-Objekts). */
export function zoomFuerAnsicht(z: ZoomAnfrageStand): ZoomAnfrageStand {
  return { id: z.id, zustand: z.zustand, zweck: z.zweck, von: z.von, bis: z.bis, am: z.am };
}

/** Z1: gemerkter Entzug aus den Einstellungen: `grund` einer der vier Werte, `am` eine endliche Zahl, sonst null. */
export function leseEntzugAus(x: unknown): { grund: EntzugGrund; am: number } | null {
  if (typeof x !== 'object' || x === null) return null;
  const e = x as { grund?: unknown; am?: unknown };
  if (typeof e.grund !== 'string' || !ENTZUG_CODES.includes(e.grund) || typeof e.am !== 'number' || !Number.isFinite(e.am)) return null;
  return { grund: e.grund as EntzugGrund, am: e.am };
}

/** AR30: `exp` muss eine endliche Zahl sein, `kontoBis` null oder eine endliche Zahl; sonst ist die gespeicherte Sitzung unlesbar. */
function fristenGueltig(s: GespeicherteSitzung): boolean {
  const st = s.stand as Partial<KontoStand> | undefined;
  return !!st && typeof st.exp === 'number' && Number.isFinite(st.exp) && typeof st.iat === 'number' && Number.isFinite(st.iat)
    && (st.kontoBis === null || (typeof st.kontoBis === 'number' && Number.isFinite(st.kontoBis)));
}

const MIT_TOKEN: readonly KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];
const ENTZUG_CODES: readonly string[] = ['gesperrt', 'geloescht', 'zugang-abgelaufen', 'geraet-unbekannt'];

export function erzeugeSitzungsTreiber(u: SitzungsUmgebung): SitzungsTreiber {
  let gestartet = false;
  let zustand: KontoZustand = 'pruefe';
  let sitzung: GespeicherteSitzung | null = null;
  /** Stand nur zur Anzeige (abgelaufen: das Datum „Zugang bis“), ohne Token. */
  let anzeigeStand: KontoStand | null = null;
  let grund: EntzugGrund | AblaufGrund | StoerGrund | null = null;
  const hinweise: Array<KontoAnsicht['hinweise'][number]> = [];
  let ausgaben: FreigabeAusgabe[] = [];
  let zoomAnfrage: ZoomAnfrageStand | null = null;
  let adminOffen = 0;
  let letztePruefung: number | null = null;
  /** Jede Anmeldung und jedes Abmelden zählt hoch; Antworten aus einem früheren Lauf werden verworfen. */
  let lauf = 0;
  let wiederholungMs = WIEDERHOLUNG_START_MS;
  let stoppeWecker: (() => void) | null = null;
  let erneuerung: Promise<string | null> | null = null;
  let gemeldet = '';
  /** Z1: nach stoppe() entsteht kein Wecker mehr und lage() fragt nicht mehr. */
  let beendet = false;

  const devVariablen = DEV_VARIABLEN.filter((n) => u.devVariablen.includes(n));

  function ansicht(): KontoAnsicht {
    const stand = sitzung?.stand ?? anzeigeStand;
    return {
      zustand,
      stand: stand ? standFuerAnsicht(stand) : null,
      grund,
      // R12: bis dahin gilt ein Start (ohne „Zugang bis“ die 30 Tage der Sitzung).
      gueltigBis: stand ? Math.min(stand.exp, stand.kontoBis ?? Infinity) : null,
      rechnerName: u.rechnerName,
      plattform: u.plattform,
      hinweise: [...hinweise],
      devVariablen: [...devVariablen],
      zoomAnfrage: zoomAnfrage ? zoomFuerAnsicht(zoomAnfrage) : null,
      adminOffen,
      ausgaben: ausgaben.map((a) => ({ ...a })),
      letztePruefung,
    };
  }

  /** R12: melde genau einmal je geänderter Ansicht; vor dem Start meldet der Treiber nichts. */
  function aktualisiere(): void {
    if (!gestartet) return;
    const a = ansicht();
    const json = JSON.stringify(a);
    if (json === gemeldet) return;
    gemeldet = json;
    u.melde(a);
  }

  /**
   * Speichern ist Nebenwirkung, nie Voraussetzung (AR34, Review): Der Zustand und der Wecker stehen vor dem Speichern, ein
   * Fehler der Hülle (Platte voll, safeStorage) bricht den Ablauf nicht ab. Kein Log hier (G4): Der Treiber schluckt den Fehler;
   * protokollieren muss die Hülle in ihrer `speichere`-Umsetzung (Task 21). `speichere` und `merkeEntzug` bleiben synchron,
   * sonst fängt `sicher()` eine Ablehnung nicht.
   */
  function sicher(f: () => void): void {
    try { f(); } catch { /* bewusst geschluckt */ }
  }
  function speichere(s: GespeicherteSitzung | null): void { sicher(() => u.speicher.speichere(s)); }
  function merkeEntzug(e: { grund: EntzugGrund; am: number } | null): void { sicher(() => u.speicher.merkeEntzug(e)); }
  function loescheEntzug(): void { sicher(() => { if (u.speicher.ladeEntzug() !== null) u.speicher.merkeEntzug(null); }); }

  function weckerAus(): void {
    stoppeWecker?.();
    stoppeWecker = null;
  }

  /**
   * Grund für „abgelaufen“ (K25c, K25d, K25k): „Zugang bis“ erreicht; sonst 30 Tage; lehnt der Worker eine noch gültige Sitzung
   * eines Google-Kontos ab, dessen letzte Anmeldung mit Google 90 Tage oder länger her ist, die Neuanmeldung (OFP8).
   */
  function ablaufGrund(stand: KontoStand, jetzt: number): AblaufGrund {
    if (stand.kontoBis !== null && stand.kontoBis <= jetzt) return 'zugang-bis';
    if (stand.exp > jetzt && stand.art === 'google' && stand.angemeldetSeit + GOOGLE_NEU_MS <= jetzt) return 'google-neu';
    return 'dreissig-tage';
  }

  function setzeAbgelaufen(stand: KontoStand, jetzt: number): void {
    // OFP8 (Nachfix 1): Hat der Server die Sitzung im Betrieb schon nicht mehr verlängert, bleibt google-neu der Grund (K25k).
    const g = zustand === 'angemeldet' && grund === 'google-neu' ? 'google-neu' : ablaufGrund(stand, jetzt);
    weckerAus();
    sitzung = null;
    anzeigeStand = stand;
    zustand = 'abgelaufen';
    grund = g;
    speichere(null);
  }

  /** Entzug beim ersten Versuch (R5): abgemeldet bis zur nächsten Anmeldung (R2). */
  function setzeEntzogen(g: EntzugGrund, jetzt: number): void {
    weckerAus();
    sitzung = null;
    anzeigeStand = null;
    zustand = 'entzogen';
    grund = g;
    merkeEntzug({ grund: g, am: jetzt });
    speichere(null);
  }

  /** Entzug bei laufender Sitzung (R5 nachgeholt, R8): Sitzung bleibt im Speicher bis zum Neustart, die Platte wird leer. */
  function setzeEntzogenLaeuft(g: EntzugGrund, jetzt: number): void {
    weckerAus();
    zustand = 'entzogen-laeuft';
    grund = g;
    planeLaufzeit();
    merkeEntzug({ grund: g, am: jetzt });
    speichere(null);
  }

  /** R3, auch im Betrieb (Nachfix 1): Der Worker erkennt die Sitzung nicht (z. B. neuer Schlüssel am Server), Hinweis K25i. */
  function setzeUnbekannt(): void {
    weckerAus();
    sitzung = null;
    anzeigeStand = null;
    zustand = 'nicht-angemeldet';
    grund = null;
    if (!hinweise.includes('sitzung-unlesbar')) hinweise.push('sitzung-unlesbar');
    speichere(null);
  }

  /**
   * OFP8 im Betrieb (EP29, Nachfix 1): Der Server verlängert die Sitzung nicht mehr, weil die letzte Anmeldung mit Google 90 Tage
   * oder länger her ist. Sie gilt wie nach einem Entzug bis `exp` weiter (Spec 6.3); der Konto-Dialog sagt das (K25o), der
   * Wecker steht auf `exp` (keine weitere Neuprüfung), danach `abgelaufen` mit K25k.
   */
  function setzeGoogleNeuLaeuft(): void {
    zustand = 'angemeldet';
    grund = 'google-neu';
    planeLaufzeit();
  }

  /** EP30, EP31 im Betrieb wie beim Start (Nachfix 1): Grund zeigen (K13a/K13b, K25m/K25n), Sitzung behalten, Wiederholung. */
  function setzeGestoert(g: StoerGrund): void {
    zustand = 'server-nicht-erreichbar';
    grund = g;
    planeWiederholung();
  }

  function planeWiederholung(): void {
    weckerAus();
    if (beendet) return;
    const ms = wiederholungMs;
    wiederholungMs = Math.min(wiederholungMs * 2, WIEDERHOLUNG_MAX_MS);
    // R5, EP29 (Nachfix 2): nie über `exp` hinaus; bei `exp` endet die Sitzung ohne Anfrage (pruefeSitzung), statt bis zu
    // 5 min länger „gültig bis“ zu zeigen.
    const bisExp = sitzung ? Math.max(0, sitzung.stand.exp - u.jetzt()) : ms;
    stoppeWecker = u.wecker(Math.min(ms, bisExp), () => {
      stoppeWecker = null;
      void pruefeSitzung(true);
    });
  }

  /**
   * EP29 (Spec 6.1, Obergrenze 30 Tage): der Wecker in `angemeldet` und `entzogen-laeuft`. In `angemeldet` steht er auf
   * 24 h vor `exp` (Neuprüfung), nach einem Fehlschlag der Neuprüfung auf der Wiederholung aus R5; in `entzogen-laeuft` auf
   * `exp`. Nie später als `exp`, höchstens WECKER_MAX_MS; wer zu früh geweckt wird, stellt den Wecker neu.
   */
  function planeLaufzeit(wiederholung = false): void {
    weckerAus();
    if (beendet) return;
    const s = sitzung;
    if (!s || (zustand !== 'angemeldet' && zustand !== 'entzogen-laeuft')) return;
    const jetzt = u.jetzt();
    let ziel = s.stand.exp;
    if (zustand === 'angemeldet' && wiederholung) {
      ziel = Math.min(ziel, jetzt + wiederholungMs);
      wiederholungMs = Math.min(wiederholungMs * 2, WIEDERHOLUNG_MAX_MS);
    } else if (zustand === 'angemeldet' && grund !== 'google-neu') {
      // Mit Grund google-neu (OFP8) prüft der Treiber nicht mehr neu; der Wecker steht auf `exp`.
      ziel = Math.max(jetzt, ziel - NEUPRUEFUNG_VORLAUF_MS);
    }
    stoppeWecker = u.wecker(Math.max(0, Math.min(ziel - jetzt, WECKER_MAX_MS)), () => {
      stoppeWecker = null;
      void wache(s, ziel);
    });
  }

  /** Der Wecker aus planeLaufzeit: `exp` erreicht → Sitzung zu Ende (ohne Anfrage); fällig → Neuprüfung; sonst neu stellen. */
  async function wache(s: GespeicherteSitzung, ziel: number): Promise<void> {
    if (sitzung !== s) return;
    const jetzt = u.jetzt();
    if (s.stand.exp <= jetzt) {
      sitzungZuEnde(s, jetzt);
      aktualisiere();
      return;
    }
    if (zustand === 'angemeldet' && jetzt >= ziel) {
      await erneuereEinmal(s);
      return;
    }
    planeLaufzeit();
  }

  /**
   * EP29: `exp` ist erreicht, ohne dass eine Erneuerung gelang. Keine Anfrage mehr (der Worker erneuert nur gültige Sitzungen,
   * 10.1): `entzogen-laeuft` wird `entzogen` (der Grund bleibt), sonst `abgelaufen`.
   */
  function sitzungZuEnde(s: GespeicherteSitzung, jetzt: number): void {
    if (zustand === 'entzogen-laeuft') {
      weckerAus();
      sitzung = null;
      anzeigeStand = null;
      zustand = 'entzogen';
      return;
    }
    setzeAbgelaufen(s.stand, jetzt);
  }

  /** Start-Prüfung (R5): Erneuerung mit Gerätebeweis; `nachgeholt` nach offline bzw. Server nicht erreichbar. */
  async function pruefeSitzung(nachgeholt: boolean): Promise<void> {
    const s = sitzung;
    const g = u.geraet;
    if (!s || !g) return;
    const meinLauf = lauf;
    if (s.stand.exp <= u.jetzt()) {
      setzeAbgelaufen(s.stand, u.jetzt());
      aktualisiere();
      return;
    }
    let ergebnis: { sitzung: string; stand: KontoStand } | null = null;
    let code: string = 'server';
    try {
      const beweis = await g.beweis('erneuern', s.stand.kid, u.jetzt());
      ergebnis = await u.client.sitzungErneuern(s.token, beweis, u.version, u.rechnerName);
    } catch (e) {
      code = e instanceof KontoFehler ? e.code : 'server';
    }
    // Eine späte Antwort ändert nichts, wenn die Prüfung inzwischen anderswo entschieden wurde (z. B. Entzug durch lage()).
    if (meinLauf !== lauf || sitzung !== s || !(zustand === 'pruefe' || zustand === 'offline' || zustand === 'server-nicht-erreichbar')) return;
    const jetzt = u.jetzt();
    if (ergebnis) {
      wiederholungMs = WIEDERHOLUNG_START_MS;
      sitzung = { token: ergebnis.sitzung, stand: ergebnis.stand };
      zustand = 'angemeldet';
      grund = null;
      letztePruefung = jetzt;
      planeLaufzeit();
      aktualisiere();
      speichere(sitzung);
      loescheEntzug();
      u.nachStartPruefung(ergebnis.sitzung, ergebnis.stand);
      return;
    }
    if (ENTZUG_CODES.includes(code)) {
      if (nachgeholt) setzeEntzogenLaeuft(code as EntzugGrund, jetzt);
      else setzeEntzogen(code as EntzugGrund, jetzt);
    } else if (code === 'sitzung-abgelaufen') {
      // OFP8 (Nachfix 1): Eine nachgeholte Prüfung (nach offline) wirkt wie die Neuprüfung im Betrieb, die Sitzung läuft bis exp.
      if (nachgeholt && ablaufGrund(s.stand, jetzt) === 'google-neu') setzeGoogleNeuLaeuft();
      else setzeAbgelaufen(s.stand, jetzt);
    } else if (code === 'nicht-angemeldet') {
      // Der Worker erkennt die Sitzung nicht (z. B. neuer Schlüssel am Server): neu anmelden, Hinweis K25i.
      setzeUnbekannt();
    } else {
      zustand = code === 'netz' ? 'offline' : 'server-nicht-erreichbar';
      // EP30, EP31: Der Server antwortet, die Prüfung scheitert aber an seiner Einrichtung oder an der Uhr dieses Rechners.
      grund = code === 'nicht-eingerichtet' || code === 'uhr' ? code : null;
      planeWiederholung();
    }
    aktualisiere();
  }

  function token(): string | null {
    if (!sitzung || !MIT_TOKEN.includes(zustand)) return null;
    return sitzung.stand.exp > u.jetzt() ? sitzung.token : null;
  }

  /** Gleichzeitige Erneuerungen (Bedarfe, Neuprüfung) teilen sich eine Anfrage. */
  function erneuereEinmal(s: GespeicherteSitzung): Promise<string | null> {
    if (!erneuerung) erneuerung = erneuere(s).finally(() => { erneuerung = null; });
    return erneuerung;
  }

  /**
   * Erneuerung im Betrieb (R7 Bedarf, EP29 Neuprüfung): ok → `angemeldet`, der Stand ist neu festgehalten; Entzug → vor `exp`
   * `entzogen-laeuft`, sonst `entzogen`; Netz und Server behalten die Sitzung bis `exp`, in `angemeldet` mit Wiederholung; Uhr
   * und Server nicht eingerichtet (EP30, EP31) ebenso, mit Grund wie beim Start; `nicht-angemeldet` wie R3; `sitzung-abgelaufen`
   * → `abgelaufen`, außer die letzte Anmeldung mit Google ist 90 Tage her (OFP8): Dann läuft die Sitzung bis `exp` (Nachfix 1).
   * In `entzogen-laeuft` enden `nicht-angemeldet` und `sitzung-abgelaufen` ohne OFP8 wie `exp` (EP36), ebenso eine Antwort nach
   * `exp` (Nachfix 2).
   */
  async function erneuere(s: GespeicherteSitzung): Promise<string | null> {
    const meinLauf = lauf;
    const g = u.geraet;
    let ergebnis: { sitzung: string; stand: KontoStand } | null = null;
    let code = 'server';
    try {
      if (!g) throw new KontoFehler('server', null);
      const beweis = await g.beweis('erneuern', s.stand.kid, u.jetzt());
      ergebnis = await u.client.sitzungErneuern(s.token, beweis, u.version, u.rechnerName);
    } catch (e) {
      code = e instanceof KontoFehler ? e.code : 'server';
    }
    if (meinLauf !== lauf || sitzung !== s) return token();
    const jetzt = u.jetzt();
    const nochGueltig = s.stand.exp > jetzt;
    if (ergebnis) {
      sitzung = { token: ergebnis.sitzung, stand: ergebnis.stand };
      wiederholungMs = WIEDERHOLUNG_START_MS;
      zustand = 'angemeldet';
      grund = null;
      letztePruefung = jetzt;
      planeLaufzeit();
      aktualisiere();
      speichere(sitzung);
      loescheEntzug();
      u.nachStartPruefung(ergebnis.sitzung, ergebnis.stand);
      return token();
    }
    if (ENTZUG_CODES.includes(code)) {
      if (nochGueltig) setzeEntzogenLaeuft(code as EntzugGrund, jetzt);
      else setzeEntzogen(code as EntzugGrund, jetzt);
    } else if (!nochGueltig) {
      // R7 (Nachfix 2): Kam die Antwort erst nach `exp`, endet die Sitzung wie bei `exp` (`entzogen-laeuft` → `entzogen`).
      sitzungZuEnde(s, jetzt);
    } else if (zustand === 'entzogen-laeuft'
      && (code === 'nicht-angemeldet' || (code === 'sitzung-abgelaufen' && ablaufGrund(s.stand, jetzt) !== 'google-neu'))) {
      // R7, EP36 (Nachfix 2): Der Server kennt diese Sitzung nicht mehr (S1) bzw. hält sie für abgelaufen (S2), jede Route lehnt
      // ihr Token ab. Sie endet darum wie bei `exp`: `entzogen` mit dem Grund des Entzugs, nicht K25i bzw. K25c.
      sitzungZuEnde(s, jetzt);
    } else if (code === 'nicht-angemeldet') {
      // R3 wie beim Start (Nachfix 1): K25i statt „seit 30 Tagen nicht erneuert“.
      setzeUnbekannt();
    } else if (code === 'sitzung-abgelaufen' && ablaufGrund(s.stand, jetzt) === 'google-neu') {
      // OFP8 (Nachfix 1): Die Sitzung läuft bis exp weiter (K25o); ein Entzug bleibt ein Entzug.
      if (zustand !== 'entzogen-laeuft') setzeGoogleNeuLaeuft();
    } else if (code === 'sitzung-abgelaufen') {
      setzeAbgelaufen(s.stand, jetzt);
    } else if ((code === 'uhr' || code === 'nicht-eingerichtet') && zustand !== 'entzogen-laeuft') {
      // EP30, EP31 (Nachfix 1): wie beim Start den Grund zeigen, die Sitzung behalten, Wiederholung bis exp.
      setzeGestoert(code as StoerGrund);
    } else if (zustand === 'angemeldet') {
      // EP29: die Neuprüfung wiederholt sich (30 s, verdoppelt bis 5 min), höchstens bis `exp`.
      planeLaufzeit(true);
    }
    aktualisiere();
    return token();
  }

  return {
    start(): void {
      if (gestartet) return;
      gestartet = true;
      const jetzt = u.jetzt();
      if (u.geraet === null) {
        // R1: ohne Schlüsselspeicher keine Anmeldung, unabhängig vom Rest.
        zustand = 'kein-schluesselspeicher';
        aktualisiere();
        return;
      }
      const geladen = u.speicher.lade();
      // AR30: eine Frist, die keine endliche Zahl ist (NaN, Infinity, fehlt), macht die Sitzung unlesbar wie R3.
      if (geladen === 'unlesbar' || (geladen !== null && !fristenGueltig(geladen))) {
        // R3
        speichere(null);
        if (!hinweise.includes('sitzung-unlesbar')) hinweise.push('sitzung-unlesbar');
        zustand = 'nicht-angemeldet';
        aktualisiere();
        return;
      }
      if (geladen === null) {
        // R2
        const entzug = u.speicher.ladeEntzug();
        zustand = entzug ? 'entzogen' : 'nicht-angemeldet';
        grund = entzug ? entzug.grund : null;
        aktualisiere();
        return;
      }
      if (geladen.stand.exp <= jetzt || (geladen.stand.kontoBis !== null && geladen.stand.kontoBis <= jetzt)) {
        // R4: keine Anfrage an den Server; ein Start nach „Zugang bis“ gilt nicht, auch ohne Internet (Spec 6.1).
        setzeAbgelaufen(geladen.stand, jetzt);
        aktualisiere();
        return;
      }
      // R5: sofort „Prüfung läuft“ mit Stand, dann im Hintergrund erneuern.
      sitzung = geladen;
      zustand = 'pruefe';
      aktualisiere();
      void pruefeSitzung(false);
    },

    ansicht,
    token,

    async sitzungFuerBedarf(): Promise<string | null> {
      const s = sitzung;
      if (!s || !MIT_TOKEN.includes(zustand)) return null;
      const rest = s.stand.exp - u.jetzt();
      if (rest > ERNEUERN_VORLAUF_MS) return s.token;
      if (rest <= 0) {
        // EP29: nach `exp` keine Anfrage mehr; die Sitzung ist zu Ende (eine laufende Start-Prüfung entscheidet selbst).
        if (zustand !== 'pruefe') {
          sitzungZuEnde(s, u.jetzt());
          aktualisiere();
        }
        return null;
      }
      return erneuereEinmal(s);
    },

    angemeldet(s: GespeicherteSitzung): void {
      // R9
      lauf++;
      weckerAus();
      wiederholungMs = WIEDERHOLUNG_START_MS;
      const erste = u.ersteAnmeldung ? u.ersteAnmeldung() === null : false;
      sitzung = { token: s.token, stand: s.stand };
      anzeigeStand = null;
      speichere(sitzung);
      loescheEntzug();
      const i = hinweise.indexOf('sitzung-unlesbar');
      if (i >= 0) hinweise.splice(i, 1);
      zustand = 'angemeldet';
      grund = null;
      zoomAnfrage = null;
      adminOffen = 0;
      letztePruefung = u.jetzt();
      planeLaufzeit();
      aktualisiere();
      u.nachAnmeldung(sitzung, erste);
    },

    async abmelden(): Promise<void> {
      // R10: lokal sofort abgemeldet; der Worker erfährt es nebenher (best effort, wartet nicht).
      const alt = sitzung;
      lauf++;
      weckerAus();
      sitzung = null;
      anzeigeStand = null;
      speichere(null);
      zustand = 'nicht-angemeldet';
      grund = null;
      zoomAnfrage = null;
      adminOffen = 0;
      aktualisiere();
      u.nachAbmelden();
      if (alt) u.client.abmelden(alt.token).catch(() => undefined);
    },

    async lage(): Promise<void> {
      // R8: nur mit laufender Sitzung in angemeldet, offline oder Server nicht erreichbar.
      const s = sitzung;
      if (beendet) return;
      // Der Wecker kam nicht (Schlaf): nach `exp` endet die Sitzung auch hier, ohne Anfrage (wie sitzungFuerBedarf).
      if (s && zustand !== 'pruefe' && MIT_TOKEN.includes(zustand) && s.stand.exp <= u.jetzt()) {
        sitzungZuEnde(s, u.jetzt());
        aktualisiere();
        return;
      }
      const t = token();
      if (!s || !t || (zustand !== 'angemeldet' && zustand !== 'offline' && zustand !== 'server-nicht-erreichbar')) return;
      const meinLauf = lauf;
      let r: Awaited<ReturnType<KontoClient['ich']>>;
      try {
        r = await u.client.ich(t);
      } catch {
        return;
      }
      if (meinLauf !== lauf || sitzung !== s) return;
      const jetzt = u.jetzt();
      letztePruefung = jetzt;
      zoomAnfrage = r.zoomAnfrage;
      adminOffen = s.stand.stufe === 'admin' ? r.adminOffen : 0;
      if (!r.kontoAktiv) {
        setzeEntzogenLaeuft(r.grund ?? 'gesperrt', jetzt);
      } else if (zustand === 'offline' || zustand === 'server-nicht-erreichbar') {
        // Der Server antwortet wieder: die Start-Prüfung sofort nachholen, statt auf den Wecker zu warten (G7).
        weckerAus();
        void pruefeSitzung(true);
      }
      aktualisiere();
    },

    stoppe(): void {
      beendet = true;
      weckerAus();
    },

    merkeAusgabe(a: FreigabeAusgabe): void {
      ausgaben = [...ausgaben, { appId: a.appId, zweck: a.zweck, ziel: a.ziel, bis: a.bis, am: a.am }].slice(-AUSGABEN_MAX);
      aktualisiere();
    },

    merkeHinweis(h: KontoAnsicht['hinweise'][number]): void {
      if (hinweise.includes(h)) return;
      hinweise.push(h);
      aktualisiere();
    },
  };
}

// ── Ablage der Sitzung (Task 21; EP2, R3, G6; Nachbesserung Abschluss, sicherheit:12) ──
/**
 * G6: Die Sitzung geht nur verschlüsselt in ihr Feld (`kontoSitzungEnc` in settings.json; die Hülle verdrahtet safeStorage
 * und settings.ts), ohne Schlüsselspeicher gar nicht (sie gilt dann nur bis zum Neustart), nie als Klartext. Unlesbar oder ohne
 * Schlüsselspeicher gelesen → 'unlesbar' (R3: neu anmelden). `null` leert das Feld (Abmelden, Entzug).
 * AR58: auch ein Stand mit unendlichem oder fehlendem exp, iat oder kontoBis (null oder endliche Zahl) ist 'unlesbar'.
 */
export function sitzungsAblage(
  v: Verschluesseler,
  feld: { lies(): string | undefined; schreib(wert: string | undefined): void },
): Pick<SitzungsUmgebung['speicher'], 'lade' | 'speichere'> {
  return {
    lade() {
      const roh = feld.lies();
      if (!roh) return null;
      if (!v.verfuegbar()) return 'unlesbar';
      try {
        const s = JSON.parse(v.entschluesseln(roh)) as Partial<GespeicherteSitzung> | null;
        const st = s?.stand;
        const brauchbar = !!s && typeof s.token === 'string' && !!st && Number.isFinite(st.exp) && Number.isFinite(st.iat)
          && (st.kontoBis === null || Number.isFinite(st.kontoBis));
        return brauchbar ? (s as GespeicherteSitzung) : 'unlesbar';
      } catch {
        return 'unlesbar';
      }
    },
    speichere(s) {
      if (s === null) {
        feld.schreib(undefined);
        return;
      }
      if (!v.verfuegbar()) return;
      feld.schreib(v.verschluesseln(JSON.stringify(s)));
    },
  };
}

// ── Ende des Moduls ──
