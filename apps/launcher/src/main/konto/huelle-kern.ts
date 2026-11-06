// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Nachrunde Z1: die reinen Teile der Hülle (konto/huelle.ts lädt Electron und läuft im
// Selbsttest nicht). Hier stehen die Entscheidungen, die sich ohne Electron prüfen lassen: Meldungen des Übergangs (K33 bleibt
// stehen, K32/I11 überleben einen Neustart), das Nachholen des GitHub-Löschens, die erste Anmeldung, das Zustands-Log, der
// Fehlercode von „Anmelden“ und die Adresse für Browser und Zwischenablage. Kein electron-Import (G9). Nichts hier schreibt
// ein Geheimnis in ein Log (G4): Fehler erscheinen nur mit ihrem Namen.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminAktionErgebnis, AdminUebersicht, AnmeldeSchritt, KontoFehlerCode, KontoZustand,
} from '../../shared/konto';
import type { KontoAdminAktionAntwort } from '../../shared/types';
import type { IveoHinweis, IveoZentral } from './worker-client';
import { browserAdresseErlaubt } from './worker-client';

/** K33 bleibt so lange stehen, bevor die Übergangsmeldung (K32/I11) folgt. */
export const K33_STEHT_MS = 4000;

const fehlerName = (e: unknown): string => (e as { name?: unknown } | null)?.name?.toString() || 'Fehler';

/** Die gemerkte Übergangsmeldung (settings.json, kein Geheimnis): steht sie aus, und wurde ein GitHub-Zugang gelöscht (K32)? */
export interface UebergangsMerker { melden: boolean; github: boolean }

export interface UebergangsUmgebung {
  speicher: { lies(): UebergangsMerker | null; schreib(m: UebergangsMerker | null): void };
  jetzt(): number;
  wecker(ms: number, fn: () => void): () => void;
  /** Die Meldung an den Renderer (Hinweisleiste). */
  melde(text: string): void;
  log(zeile: string): void;
}

/**
 * Z1 (Nr. 8): K32 und I11 kommen erst nach K33 (die Anmeldemeldung bleibt K33_STEHT_MS stehen) und überleben einen Neustart vor
 * dem ersten erfolgreichen Laden der Tokens: Sie werden in settings.json gemerkt und erst nach der Meldung gelöscht.
 */
export function erzeugeUebergang(u: UebergangsUmgebung) {
  let k33Am: number | null = null;
  let stoppeZeitgeber: (() => void) | null = null;
  /** Fixrunde 1 (Nr. 2): gemeldet ist gemeldet, auch wenn das Löschen der Vormerkung scheitert (sonst käme sie alle 5 min wieder). */
  let gemeldet = false;

  const lies = (): UebergangsMerker | null => {
    try {
      const m = u.speicher.lies();
      return m && m.melden === true ? { melden: true, github: m.github === true } : null;
    } catch (e) {
      u.log(`Anmeldung: Übergangsmeldung nicht gelesen (${fehlerName(e)})`);
      return null;
    }
  };
  const schreibe = (m: UebergangsMerker | null): void => {
    try {
      u.speicher.schreib(m);
    } catch (e) {
      u.log(`Anmeldung: Übergangsmeldung nicht gespeichert (${fehlerName(e)})`);
    }
  };

  return {
    /** Die erste Anmeldung (oder das Nachholen) merkt, dass K32/I11 aussteht; `github`: ein GitHub-Zugang wurde gelöscht. */
    vormerken(github: boolean): void {
      const alt = lies();
      gemeldet = false;
      schreibe({ melden: true, github: github || alt?.github === true });
    },
    /** Was gerade vorgemerkt ist (für den Hinweis im Konto-Dialog nach einem Neustart). */
    vorgemerkt(): UebergangsMerker | null {
      return lies();
    },
    /** K33 wurde gerade gezeigt. */
    k33Gezeigt(): void {
      k33Am = u.jetzt();
    },
    /** Beim Abmelden: der Zeitgeber geht. Die Vormerkung bleibt (sie kommt mit dem nächsten Laden nach der nächsten Anmeldung). */
    abmelden(): void {
      stoppeZeitgeber?.();
      stoppeZeitgeber = null;
    },
    /**
     * Die Tokens sind einmal geladen: steht eine Meldung aus, kommt sie, sobald K33 seine Zeit hatte, und wird danach gelöscht.
     * `text` baut die Meldung (null = nichts zu sagen; dann wird nur die Vormerkung gelöscht).
     */
    nachLaden(text: (github: boolean) => string | null): void {
      const m = lies();
      if (!m || stoppeZeitgeber || gemeldet) return;
      const t = text(m.github);
      if (t === null) {
        schreibe(null);
        return;
      }
      const warte = k33Am === null ? 0 : Math.max(0, k33Am + K33_STEHT_MS - u.jetzt());
      stoppeZeitgeber = u.wecker(warte, () => {
        stoppeZeitgeber = null;
        gemeldet = true;
        u.melde(t);
        schreibe(null);
      });
    },
  };
}

/**
 * Z1 (Nr. 8, [T]): Text der Übergangsmeldung aus den ZIELEN des Löschlaufs. I11 nennt nur Event-Kennungen: Basis-Tokens
 * (`base:‹URL›`) sind kein Event und erscheinen nie. Die Texte kommen von der Hülle.
 */
export function uebergangsText(a: {
  github: boolean; bleiben: readonly string[]; spaetestens: number;
  textGithub: string; textLokal(slugs: readonly string[], spaetestens: number): string;
}): string | null {
  const events = a.bleiben.filter((k) => !k.startsWith('base:'));
  const teile = [a.github ? a.textGithub : null, events.length ? a.textLokal(events, a.spaetestens) : null].filter((t): t is string => t !== null);
  return teile.length ? teile.join(' ') : null;
}

/**
 * Z1 (Nr. 6): die erste Anmeldung auf diesem Rechner. Das Schreiben der Zeit wirft nie nach außen (nur der Fehlername kommt ins
 * Log); die Haken laufen trotzdem, jeder für sich. Ohne gespeicherte erste Anmeldung läuft der Ablauf bei der nächsten Anmeldung
 * noch einmal (die Haken sind darauf ausgelegt).
 */
export function ersteAnmeldungVerarbeiten(d: {
  lies(): number | null; schreibe(ms: number): void; haken: ReadonlyArray<() => void>; jetzt(): number; log(zeile: string): void;
}): boolean {
  if (d.lies() !== null) return false;
  try {
    d.schreibe(d.jetzt());
  } catch (e) {
    d.log(`Anmeldung: erste Anmeldung nicht gespeichert (${fehlerName(e)})`);
  }
  for (const f of d.haken) {
    try {
      f();
    } catch (e) {
      d.log(`Anmeldung: Aufräumen nach der ersten Anmeldung gescheitert (${fehlerName(e)})`);
    }
  }
  return true;
}

/**
 * Z1 (Nr. 6): Wirft das Löschen des GitHub-Zugangs, bleibt er für immer stehen (die erste Anmeldung ist schon gemerkt). Beim
 * nächsten Start holt die Hülle es nach: Steht `kontoErsteAnmeldung` und ist noch ein GitHub-Zugang da, wird er gelöscht.
 * true, wenn jetzt einer gelöscht wurde.
 */
export function githubZugangNachholen(d: { ersteAnmeldung: number | null; loesche(): boolean; log(zeile: string): void }): boolean {
  if (d.ersteAnmeldung === null) return false;
  try {
    return d.loesche();
  } catch (e) {
    d.log(`Anmeldung: GitHub-Zugang nicht gelöscht (${fehlerName(e)})`);
    return false;
  }
}

/**
 * Z1 (Nr. 6): das Löschen selbst, rein. Entfernt nur den GitHub-Zugang (verschlüsselt und Klartext); jedes andere Feld, auch
 * `proxyUrl`, bleibt. `war`: es gab einen.
 */
export function ohneGithubZugang<T extends { githubToken?: string; githubTokenEnc?: string }>(s: T): { neu: T; war: boolean } {
  const war = s.githubToken !== undefined || s.githubTokenEnc !== undefined;
  const neu = { ...s };
  delete neu.githubToken;
  delete neu.githubTokenEnc;
  return { neu, war };
}

/** Z1 (Nr. 6): Logzeile nur bei einem Zustandswechsel; sonst null. Ins Log kommt nur der Zustand, nie Stand oder Sitzung. */
export function zustandsLogger(): (zustand: KontoZustand) => string | null {
  let letzter: KontoZustand | null = null;
  return (zustand) => {
    if (zustand === letzter) return null;
    letzter = zustand;
    return `Anmeldung: Zustand ${zustand}`;
  };
}

/** Z1 (Nr. 6, G7): der Fehler von „Anmelden“ nennt den wahren Grund: ohne Schlüsselspeicher den Schlüsselspeicher, sonst den Server. */
export function anmeldenOhneAblauf(zustand: KontoZustand): AnmeldeSchritt {
  return { art: 'fehler', code: zustand === 'kein-schluesselspeicher' ? 'kein-schluesselspeicher' : 'server' };
}

/**
 * Z1 (Nr. 6): die Adresse für Browser und Zwischenablage in der Form, die `URL` selbst ausgibt (`new URL(url).href`); nur wenn
 * sie beim Worker liegt und https hat (browserAdresseErlaubt). Sonst null.
 */
export function browserHref(url: string, server: string): string | null {
  if (!browserAdresseErlaubt(url, server)) return null;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

/**
 * Z1 (Nr. 5): eine Admin-Aktion ausführen. Gelingt die Aktion, kommt ihr Ergebnis (z. B. der Einladungscode, den der Worker nur
 * einmal liefert) beim Aufrufer an, auch wenn die Folge-Übersicht scheitert: Dann trägt die Antwort `daten: null` und den
 * eigenen Fehler der Übersicht (`uebersichtFehler`). Das Nachziehen der Lage (Punkt am Zahnrad) wirft nie nach außen.
 */
export async function adminAktionAusfuehren(d: {
  aktion(): Promise<AdminAktionErgebnis>; uebersicht(): Promise<AdminUebersicht>; lage(): Promise<void>; fehlerCode(e: unknown): KontoFehlerCode;
}): Promise<KontoAdminAktionAntwort> {
  let ergebnis: AdminAktionErgebnis;
  try {
    ergebnis = await d.aktion();
  } catch (e) {
    return { ok: false, code: d.fehlerCode(e) };
  }
  let daten: AdminUebersicht | null = null;
  let uebersichtFehler: KontoFehlerCode | undefined;
  try {
    daten = await d.uebersicht();
  } catch (e) {
    uebersichtFehler = d.fehlerCode(e);
  }
  try {
    await d.lage();
  } catch {
    /* der Punkt am Zahnrad folgt beim nächsten Takt */
  }
  return uebersichtFehler === undefined ? { ok: true, ergebnis, daten } : { ok: true, ergebnis, daten, uebersichtFehler };
}

/**
 * Z1 (Nr. 7): das Laden der iveo-Tokens. Höchstens ein Lauf zugleich. Wechselt während des Wartens der Lauf (Abmelden) oder das
 * Konto, wird die Antwort verworfen und, ist schon ein neues Konto da, neu geladen (die Sperre ist dann frei): auch dann, wenn
 * die Anfrage scheiterte. Ohne Sitzung gilt nur die Frist für lokale Tokens (`fertig`).
 */
export function erzeugeIveoLader(d: {
  token(): string | null; kid(): string | null; lauf(): number;
  lade(token: string): Promise<{ events: IveoZentral[]; hinweis: IveoHinweis | null }>;
  uebernimm(r: { events: IveoZentral[]; hinweis: IveoHinweis | null }, kid: string | null): void;
  fertig(): void; log(zeile: string): void; fehlerCode(e: unknown): string;
}): { lade(): Promise<void> } {
  let laedt = false;
  const fertig = (): void => {
    try {
      d.fertig();
    } catch (e) {
      d.log(`Anmeldung: Abschluss des iveo-Ladens gescheitert (${fehlerName(e)})`);
    }
  };
  async function lade(): Promise<void> {
    const t = d.token();
    if (!t) {
      fertig();
      return;
    }
    if (laedt) return;
    laedt = true;
    const lauf = d.lauf();
    const kid = d.kid();
    const veraltet = (): boolean => lauf !== d.lauf() || kid !== d.kid();
    try {
      const r = await d.lade(t);
      laedt = false;
      if (veraltet()) {
        if (d.token()) void lade();
        return;
      }
      d.uebernimm(r, kid);
    } catch (e) {
      laedt = false;
      d.log(`Anmeldung: iveo-Tokens nicht geladen (${d.fehlerCode(e)})`);
      if (veraltet()) {
        if (d.token()) void lade();
        return;
      }
    }
    fertig();
  }
  return { lade };
}

/**
 * Z1 (Nr. 10, AR58): ein Speichern, das nie nach außen wirft (ein Schreibfehler an settings.json darf den Treiber nicht abbrechen);
 * ins Log kommt nur der Fehlername, nie der Inhalt (G4).
 */
export function ohneWurf<A extends unknown[]>(f: (...a: A) => void, log: (zeile: string) => void, text: string): (...a: A) => void {
  return (...a) => {
    try {
      f(...a);
    } catch (e) {
      log(`${text} (${fehlerName(e)})`);
    }
  };
}

/** Z1 (Nr. 10): die Antwort der Discovery an den Renderer trägt nur Slug und Name (nie ein Token, nie ein Rest des Objekts). */
export function eventsFuerRenderer(events: ReadonlyArray<{ slug: string; name: string }>): Array<{ slug: string; name: string }> {
  return events.map((e) => ({ slug: e.slug, name: e.name }));
}

/** Z1 (Nr. 10, T23 f): hat ein anderes Konto angemeldet als das, dessen Tokens im Speicher liegen? Dann gehören sie geleert. */
export function kontoGewechselt(altKid: string | null, neuKid: string): boolean {
  return altKid !== null && altKid !== neuKid;
}

// ── Ende des Moduls ──
