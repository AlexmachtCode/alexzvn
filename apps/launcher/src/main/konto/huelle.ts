// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher: Hülle im Main (Plan P21; Spec 6.1, 6.2, 7, 2 Anti-Ziele; EP2, EP7, EP8, EP12, EP26).
// Die EINZIGE Datei unter src/main/konto/, die Electron lädt (G9): safeStorage, IPC, Browser, Zwischenablage, Version.
// Die Logik steckt in den reinen Modulen (geraet, worker-client, sitzung-kern, anmelde-ablauf, tuer-dienst, freigaben,
// iveo-zentral); hier wird nur verdrahtet. Keine Antwort an den Renderer trägt eine Sitzung, eine Freigabe oder ein
// iveo-Token (10.7); keine Logzeile nennt Sitzung, Code, Abholgeheimnis oder Token (G4).
// starteKonto() kehrt sofort zurück: der Start des Launchers wartet auf nichts davon (G5, Spec 2 Anti-Ziel).
// ─────────────────────────────────────────────────────────────────────────────
import { app, clipboard, safeStorage, shell, type IpcMain } from 'electron';
import { hostname } from 'node:os';
import type { Logger } from '@jm/app-runtime';
import { IveoClient } from '@jm/iveo';
import type {
  AppEvent, KontoAdminAktionAntwort, KontoAdminAntwort, KontoIveoEvent, KontoIveoEventsAntwort, KontoZoomAntwort,
} from '@shared/types';
import {
  darf, kurzName, STUFE_TEXT, type AdminAktion, type AnmeldeSchritt, type Funktion, type KontoAnsicht, type KontoFehlerCode,
  type KontoStand, type KontoZustand,
} from '@shared/konto';
import { ladeOderErzeugeGeraet, type GeraetHandle, type GeraetLaden, type Verschluesseler } from './geraet';
import {
  erzeugeKontoClient, gesperrterKontoClient, KontoFehler, kopfFuer, istWorkerZiel, pruefeServerBasis, type KontoClient,
} from './worker-client';
import { erzeugeSitzungsTreiber, sitzungsAblage, type GespeicherteSitzung, type SitzungsTreiber } from './sitzung-kern';
import { erzeugeAnmeldeAblauf, type AnmeldeAblauf } from './anmelde-ablauf';
import { starteTuerDienst } from './tuer-dienst';
import { erzeugeFreigabeStelle } from './freigaben';
import { erzeugeIveoZentral, iveoHinterlegenBasis, lokaleLoeschen, zentraleKeysFuerLoeschlauf, type IveoZentralSpeicher } from './iveo-zentral';
import {
  adminAktionAusfuehren, anmeldenOhneAblauf, browserHref, eventsFuerRenderer, kontoGewechselt, ohneWurf, erzeugeIveoLader, erzeugeUebergang, ersteAnmeldungVerarbeiten, githubZugangNachholen,
  uebergangsText, zustandsLogger,
} from './huelle-kern';
import { toClientError } from '../iveo-abgleich-kern';
import { IVEO_ABRUF_ZEITGRENZE_MS, mitZeitgrenze } from '../iveo-huelle-hilfen';
import {
  leseKontoEntzug, leseKontoErsteAnmeldung, leseKontoFeld, leseKontoUebergang, listIveoTokenKeys, loescheGithubZugang,
  loescheLokaleIveoTokens, markiereAbgleichHier, resolveIveoBaseUrl, resolveProxy, resolveProxyKey, schreibeKontoEntzug,
  schreibeKontoErsteAnmeldung, schreibeKontoFeld, schreibeKontoUebergang, verbindeIveoZentral, verbindeSitzung,
} from '../settings';
import { verbundStand } from '../verbund';
import { iveoShowOffen, tokensAktualisiert } from '../iveo-sync';

/** R13, K31: Entwicklungsvariablen, deren NAMEN der Konto-Dialog nennt. Nie die Werte. */
const DEV_NAMEN = ['JMPS_PROXY_KEY', 'JMPS_GITHUB_TOKEN', 'JMPS_RELEASE_PROXY', 'JMPS_IVEO_TOKEN'] as const;
/** EP15: Lage (GET /konto/ich) alle 5 min, bei Fensterfokus höchstens einmal je Minute. */
const LAGE_TAKT_MS = 5 * 60_000;
const LAGE_FOKUS_MS = 60_000;
/** R6: Zustände, in denen eine Sitzung nutzbar ist (der Treiber prüft zusätzlich exp). */
const SITZUNG_ZUSTAENDE: readonly KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];

/** K33: Meldung nach der Anmeldung. */
function textAngemeldet(stand: KontoStand): string {
  return `Angemeldet als ${kurzName(stand.name, stand.email)} · ${STUFE_TEXT[stand.stufe]}.`;
}
/** K34: Meldung nach dem Abmelden. */
const TEXT_ABGEMELDET = 'Abgemeldet.';
/** M5: wer laut festgehaltenem Stand kein Admin ist, bekommt keine Admin-Daten (konto:iveoEventsLaden). */
const TEXT_KEIN_ADMIN = 'Du bist kein Admin mehr. Die Admin-Maske ist geschlossen.';
/** M35 (dritter Teil): ohne Token gibt es keine Discovery. */
const TEXT_TOKEN_FEHLT = 'Füge das Token ein.';

/** EP7, G6: safeStorage als Verschlüsseler. Ohne Schlüsselspeicher „nicht verfügbar“, nie ein Klartext-Rückfall. */
const verschluesseler: Verschluesseler = {
  verfuegbar: () => safeStorage.isEncryptionAvailable(),
  verschluesseln: (klar) => safeStorage.encryptString(klar).toString('base64'),
  entschluesseln: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
};

/**
 * EP2, R3, G6: gespeicherte Sitzung nur verschlüsselt in settings.json, ohne Schlüsselspeicher gar nicht (sitzungsAblage in
 * sitzung-kern.ts, dort im Verhalten getestet); nicht lesbar → 'unlesbar' (neu anmelden).
 */
const sitzungsRoh = {
  ...sitzungsAblage(verschluesseler, {
    lies: () => leseKontoFeld('kontoSitzungEnc'),
    schreib: (wert) => schreibeKontoFeld('kontoSitzungEnc', wert),
  }),
  ladeEntzug: () => leseKontoEntzug(),
  merkeEntzug: (e: Parameters<typeof schreibeKontoEntzug>[0]) => schreibeKontoEntzug(e),
};

/**
 * AR58: Speichern wirft nie (ein Schreibfehler an settings.json darf den Treiber nicht abbrechen); die Sitzung gilt dann nur
 * bis zum Neustart. Ins Log nur der Fehlername, nie der Inhalt (G4).
 */
const sitzungsSpeicher = {
  ...sitzungsRoh,
  // Z1: ohneWurf (huelle-kern.ts, im Verhalten geprüft) — kein Wurf nach außen, im Log nur der Fehlername.
  speichere: ohneWurf(sitzungsRoh.speichere, (z) => log?.warn(z), 'Anmeldung: Sitzung nicht gespeichert'),
  merkeEntzug: ohneWurf(sitzungsRoh.merkeEntzug, (z) => log?.warn(z), 'Anmeldung: Entzug nicht gespeichert'),
};

let emit: (e: AppEvent) => void = () => undefined;
let log: Logger | null = null;
let client: KontoClient | null = null;
/** EP35: die Server-Adresse dieses Laufs (dieselbe wie für den Client); nur Adressen dort gehen an Browser und Zwischenablage. */
let serverBasis = '';
let geraet: GeraetHandle | null = null;
let treiber: SitzungsTreiber | null = null;
let ablauf: AnmeldeAblauf | null = null;
let bereit: Promise<void> | null = null;
/** Z1: das Gerät ist geladen und der Treiber läuft (t.start()); Abrufe warten darauf, nie auf den Tür-Dienst. */
let treiberBereit: Promise<void> = Promise.resolve();
let treiberFertig: () => void = () => undefined;
let tuer: { stoppe(): Promise<void> } | null = null;
let gestoppt = false;
let lageTakt: ReturnType<typeof setInterval> | null = null;
let letzteLage = 0;
const iveo = erzeugeIveoZentral();
/** P23 (I4): die Tokens des Kontos sind seit dem Start einmal geladen worden. */
let iveoGeladen = false;
/** AR60: zählt die Abmeldungen; eine Antwort aus einem älteren Lauf wird verworfen. */
let iveoLauf = 0;
/** Fixrunde 1: Konto (kid), dessen Tokens im Speicher liegen; ein anderes Konto ohne Abmelden leert sie. */
let iveoKid: string | null = null;

/** Haken nach der ersten Anmeldung auf diesem Rechner (P32 hängt das Löschen der Altlasten an, N5, OFP1). */
export const beiErsterAnmeldung: Array<() => void> = [];

function wecker(ms: number, fn: () => void): () => void {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
}

/** EP7 (Lehre B5): Rechnername wie im Verbund, damit derselbe PC überall gleich heißt; sonst der Hostname. */
function rechnerName(): string {
  try {
    return verbundStand().rechnerName.trim() || hostname();
  } catch {
    return hostname();
  }
}

const plattform = (): 'win' | 'mac' => (process.platform === 'darwin' ? 'mac' : 'win');
const arch = (): 'arm64' | 'x64' => (process.arch === 'arm64' ? 'arm64' : 'x64');
const devVariablen = (): string[] => DEV_NAMEN.filter((n) => Boolean(process.env[n]));

function fehlerCode(e: unknown): KontoFehlerCode {
  return e instanceof KontoFehler ? e.code : 'server';
}

/** G7: Ansicht, bevor der Treiber läuft — ohne Stand; sie zählt nie als angemeldet (lib/konto-anzeige.ts). */
function ansichtVorDemStart(): KontoAnsicht {
  return {
    zustand: 'pruefe', stand: null, grund: null, gueltigBis: null, rechnerName: rechnerName(), plattform: plattform(),
    hinweise: [], devVariablen: devVariablen(), zoomAnfrage: null, adminOffen: 0, ausgaben: [], letztePruefung: null,
  };
}

/**
 * Start der Anmeldung (Spec 6.1; G5): im Hintergrund Gerät laden, Treiber starten (die erste Ansicht entsteht vor jeder
 * Netzantwort, R5), Lage-Takt, Tür-Dienst für die Tools (EP8). Kehrt sofort zurück; index.ts ruft es direkt nach
 * migrateTokenAtRest() — ohne await.
 */
export function starteKonto(o: { emit(e: AppEvent): void; log: Logger; appDataDir: string }): void {
  if (bereit) return;
  emit = o.emit;
  log = o.log;
  // P22: settings.ts erfährt so, ob eine Sitzung nutzbar ist (Quelle in den Einstellungen), ohne die Hülle zu importieren.
  verbindeSitzung(kontoSitzungMoeglich);
  // P23 (EP13): die Naht getIveoToken liest zuerst diesen Speicher; die Lage sagt „angemeldet“ und „Tokens geladen“.
  verbindeIveoZentral({ speicher: iveo, lage: () => ({ angemeldet: kontoSitzungMoeglich(), geladen: iveoGeladen }) });
  // AR57 (Z1): der Client wird nur mit geprüfter Server-Adresse gebaut; sonst scheitert jeder Aufruf mit `server`.
  serverBasis = pruefeServerBasis(resolveProxy()) ?? '';
  let c: KontoClient;
  if (serverBasis) c = erzeugeKontoClient({ basis: serverBasis, fetch: (url, init) => fetch(url, init) });
  else {
    o.log.warn('Anmeldung: Server-Adresse nicht zulässig (https nötig)');
    c = gesperrterKontoClient();
  }
  client = c;
  treiberBereit = new Promise<void>((ok) => {
    treiberFertig = ok;
  });
  bereit = starte(o, c)
    .catch((e: unknown) => {
      o.log.warn(`Anmeldung nicht gestartet (${(e as Error | null)?.name ?? 'Fehler'})`);
    })
    .finally(() => treiberFertig());
}

async function starte(o: { log: Logger; appDataDir: string }, c: KontoClient): Promise<void> {
  let g: GeraetLaden;
  try {
    g = await ladeOderErzeugeGeraet(verschluesseler, {
      lies: () => leseKontoFeld('geraetSchluesselEnc'),
      schreib: (b64) => schreibeKontoFeld('geraetSchluesselEnc', b64),
    });
  } catch (e) {
    o.log.warn(`Anmeldung: Geräteschlüssel nicht ladbar (${(e as Error | null)?.name ?? 'Fehler'})`);
    g = { art: 'kein-schluesselspeicher' };
  }
  geraet = g.art === 'kein-schluesselspeicher' ? null : g.geraet;
  // Z1: nach dem Beenden (before-quit) startet nichts mehr: kein Treiber, kein Takt, kein Tür-Dienst.
  if (gestoppt) return;
  const zustandsLog = zustandsLogger();
  const t = erzeugeSitzungsTreiber({
    jetzt: () => Date.now(),
    client: c,
    geraet,
    speicher: sitzungsSpeicher,
    version: app.getVersion(),
    rechnerName: rechnerName(),
    plattform: plattform(),
    devVariablen: devVariablen(),
    wecker,
    // R12: jede Änderung genau einmal; ins Log nur der Zustand, nie Stand, Sitzung oder E-Mail.
    melde: (a) => {
      // Z1: Log nur bei einem Zustandswechsel (eine Ansicht ändert sich auch ohne ihn, z. B. bei jeder Lage).
      const zeile = zustandsLog(a.zustand);
      if (zeile) o.log.info(zeile);
      emit({ type: 'konto-changed' });
    },
    nachAnmeldung: (s) => {
      // R9: die erste Anmeldung auf diesem Rechner merkt settings.json; P32 hängt das Löschen der Altlasten an.
      // Z1: Schreibt settings.json nicht, wirft das nie nach außen (huelle-kern: Log nur mit Fehlername).
      ersteAnmeldungVerarbeiten({
        lies: leseKontoErsteAnmeldung, schreibe: schreibeKontoErsteAnmeldung, haken: beiErsterAnmeldung, jetzt: Date.now,
        log: (z) => o.log.warn(z),
      });
      emit({ type: 'notice', message: textAngemeldet(s.stand) });
      // Z1 (Nr. 8): K33 bleibt K33_STEHT_MS stehen, danach folgt die Übergangsmeldung (K32/I11).
      uebergang.k33Gezeigt();
      // Fixrunde 1: anderes Konto ohne Abmelden (z. B. nach einem Entzug) → die Tokens des vorigen Kontos nicht behalten
      if (kontoGewechselt(iveoKid, s.stand.kid)) {
        iveo.leere();
        iveoGeladen = false;
        iveoLauf++;
        iveoKid = null;
        tokensAktualisiert();
      }
      void kontoLage(false);
    },
    nachStartPruefung: () => {
      void kontoLage(false);
    },
    nachAbmelden: () => {
      iveo.leere();
      iveoGeladen = false;
      tokensAktualisiert();
      // AR60: eine noch unterwegs befindliche Antwort des alten Kontos verwerfen
      iveoLauf++;
      // Z1 (Nr. 8): der Zeitgeber der Übergangsmeldung geht mit der Sitzung (die Vormerkung bleibt).
      uebergang.abmelden();
      emit({ type: 'notice', message: TEXT_ABGEMELDET });
    },
  });
  treiber = t;
  if (g.art === 'neu-wegen-unlesbar') t.merkeHinweis('geraet-neu');
  t.start();
  treiberFertig();
  // Z1 (Nr. 6): Wirft das Löschen des GitHub-Zugangs nach der ersten Anmeldung, holt der Start es nach.
  if (githubZugangNachholen({ ersteAnmeldung: leseKontoErsteAnmeldung(), loesche: loescheGithubZugang, log: (z) => o.log.warn(z) })) {
    uebergang.vormerken(true);
  }
  if (uebergang.vorgemerkt()?.github) t.merkeHinweis('github-geloescht');
  lageTakt = setInterval(() => void kontoLage(false), LAGE_TAKT_MS);
  // EP8: Tür-Dienst auf 127.0.0.1 mit Tür-Datei je Start; Freigaben nur über die Freigabe-Stelle (Zweck, Ziel, 72 h).
  const stelle = erzeugeFreigabeStelle({ treiber: t, client: c, jetzt: () => Date.now(), log: (z) => o.log.info(z) });
  try {
    const d = await starteTuerDienst({ appDataDir: o.appDataDir, behandle: (a) => stelle.behandle(a), log: (z) => o.log.info(z) });
    if (gestoppt) void d.stoppe();
    else tuer = d;
  } catch (e) {
    o.log.warn(`Anmeldung: Tür-Dienst nicht gestartet (${(e as Error | null)?.name ?? 'Fehler'})`);
  }
}

/** before-quit: Takt aus, Tür-Datei löschen nur anstoßen (der Quit-Pfad wartet nie, G5). */
export function stoppeKonto(): void {
  gestoppt = true;
  if (lageTakt) clearInterval(lageTakt);
  lageTakt = null;
  // Z1: auch die Wecker des Treibers gehen aus; nach dem Beenden prüft nichts mehr im Hintergrund.
  treiber?.stoppe();
  void tuer?.stoppe();
  tuer = null;
}

/** R6: Sitzung für Abrufe dieses Prozesses; null ohne gültige Sitzung. Geht nie an den Renderer. */
export function kontoToken(): string | null {
  return treiber?.token() ?? null;
}

/** R7: Sitzung für einen Abruf, bei Bedarf erneuert (Obergrenze 30 Tage). Wartet höchstens auf das Laden des Geräts. */
export async function kontoSitzungFuerBedarf(): Promise<string | null> {
  // Z1: wartet auf das Gerät und den Treiber, nicht auf den Tür-Dienst.
  await treiberBereit;
  return treiber ? treiber.sitzungFuerBedarf() : null;
}

/** Aktuelle Ansicht (ohne Token, 10.5); vor dem Start ohne Stand (G7). */
export function kontoAnsichtJetzt(): KontoAnsicht {
  return treiber?.ansicht() ?? ansichtVorDemStart();
}

/** Ist eine Sitzung nutzbar (R6-Zustände mit Stand)? Für Quellen und Rechte (P22). */
export function kontoSitzungMoeglich(): boolean {
  const a = kontoAnsichtJetzt();
  // Z1: eine Sitzung nach `exp` ist keine nutzbare Sitzung (der Treiber gibt dann auch kein Token heraus).
  return a.stand !== null && SITZUNG_ZUSTAENDE.includes(a.zustand) && a.stand.exp > Date.now();
}

/**
 * P22 (Spec 9.1, EP12): Gibt es einen Zugang zum Worker? Sitzung (R6) oder Entwicklungs-Schlüssel (nur die
 * Umgebungsvariable JMPS_PROXY_KEY; einen eingebackenen gibt es seit P32 nicht mehr). Ohne beides fragen die Quellen den
 * Worker nicht.
 */
export function zugangDa(): boolean {
  return kontoSitzungMoeglich() || Boolean(resolveProxyKey());
}

/**
 * P22 (N12, G4): Kopf für einen Abruf beim Worker — nur wenn die Adresse beim Worker liegt (gleiche Herkunft wie die
 * Server-Adresse, Pfad mit Grenze; istWorkerAdresse, EP35), sonst {}: eine eigene Katalog-URL und ein Doppelgänger-Host
 * (`…workers.dev.evil.example`, `…workers.dev@evil.example`) bekommen nie die Sitzung. Sitzung vor Entwicklungs-Schlüssel
 * (zugangsKopf, P9); die Sitzung erneuert sich bei Bedarf (R7). Sitzung und Schlüssel stehen in keiner Meldung.
 */
export async function zugangsKopfFuer(url: string): Promise<Record<string, string>> {
  // Fixrunde 1 (Nr. 4): die Basis, zu der die Sitzung gehört (beim Start geprüft), nicht die zur Laufzeit änderbare Einstellung.
  if (!serverBasis || !istWorkerZiel(url, serverBasis)) return {};
  // Z1: kopfFuer prüft Server-Adresse und Ziel noch einmal (rein, im Verhalten geprüft).
  return kopfFuer(url, serverBasis, await kontoSitzungFuerBedarf(), resolveProxyKey());
}

/**
 * P22 (Spec 9.1): Darf dieser Rechner die Funktion am Worker nutzen? Mit Sitzung nach `darf` und dem festgehaltenen Stand
 * (nach einer Erneuerung bei Bedarf, R7); ohne Sitzung nur mit Entwicklungs-Schlüssel (der Worker prüft dann selbst).
 */
export async function workerRecht(f: Funktion): Promise<boolean> {
  await kontoSitzungFuerBedarf();
  const stand = kontoSitzungMoeglich() ? kontoAnsichtJetzt().stand : null;
  if (stand) return darf(stand, f, { jetzt: Date.now() });
  return Boolean(resolveProxyKey());
}

/** iveo-Tokens des Kontos im Speicher (P23 füllt ihn und verdrahtet die Naht in settings.ts). */
export function iveoZentral(): IveoZentralSpeicher {
  return iveo;
}

/**
 * P23 (EP13, IV3): die iveo-Tokens des Kontos in den Speicher — nie auf die Platte, nie ins Log, nie an den Renderer.
 * Scheitert das Laden, bleiben schon geladene Tokens (G5). Danach meldet die Hülle dem Kern die neue Lage: eine offene Show,
 * die ohne Token aufgesetzt wurde, setzt er neu auf; ohne Token nennt die Statuszeile den aktuellen Grund (I1–I4).
 * Z1: der Ablauf steht in huelle-kern.ts (erzeugeIveoLader, im Verhalten geprüft); ein Konto- oder Laufwechsel während des
 * Wartens startet das Laden neu, auch wenn die Anfrage scheiterte.
 */
const iveoLader = erzeugeIveoLader({
  token: () => (client ? kontoToken() : null),
  kid: () => kontoAnsichtJetzt().stand?.kid ?? null,
  lauf: () => iveoLauf,
  // EP31: der Hinweis des Workers (iveo dort nicht eingerichtet) geht mit in den Speicher; die Statuszeile nennt dann I12.
  lade: (t) => (client ? client.iveoTokens(t) : Promise.reject(new KontoFehler('server', null))),
  uebernimm: (r, kid) => {
    iveo.setze(r.events, Date.now(), r.hinweis);
    iveoGeladen = true;
    iveoKid = kid;
  },
  // P32 (OFP1, IV5): nach jedem Laden (und ohne Sitzung) die lokale Altlast aufräumen; danach meldet tokensAktualisiert die Lage.
  fertig: () => {
    raeumeLokaleIveoTokensAuf();
    tokensAktualisiert();
  },
  log: (z) => log?.warn(z),
  fehlerCode,
});
function ladeIveo(): Promise<void> {
  return iveoLader.lade();
}

// ── Übergang (Plan P32; Spec 10, 2 Anti-Ziel; N5, N9; EP12; OFP1, IV5) ───────────────────────────────────────────────────
// Nach der ersten Anmeldung auf diesem Rechner verschwinden die alten Geheimnisse: der gespeicherte GitHub-Zugang sofort,
// lokal gespeicherte iveo-Tokens nach OFP1. Laufendes bleibt unberührt (G5): nie bei offener iveo-Show, und vor dem Löschen
// eines Tokens bekommt sein Event „Abgleich hier“, damit dieser Rechner weiter abgleicht (EP14).

/** K32: Meldung nach der ersten Anmeldung, wenn ein gespeicherter GitHub-Zugang gelöscht wurde. */
const TEXT_GITHUB_GELOESCHT = 'Der gespeicherte GitHub-Zugang wurde gelöscht; Downloads laufen jetzt über deine Anmeldung.';

/** TT.MM.JJJJ in Ortszeit des Rechners (G2). */
function datumText(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** I11 (OFP1): Events, deren Token noch lokal liegt — nur die Kennungen (Slugs), nie die Werte —, und das späteste Datum. */
function textLokaleIveo(slugs: readonly string[], spaetestens: number): string {
  return `Diese Events haben auf diesem Rechner noch ein lokal gespeichertes Token: ${slugs.join(', ')}. Es wird gelöscht, sobald ein Admin das Event zentral hinterlegt, spätestens am ${datumText(spaetestens)}.`;
}

/**
 * Nach der ersten Anmeldung stehen K32 und I11 aus, bis die Tokens einmal geladen sind (erst dann ist die Liste wahr). Z1: Sie
 * kommen erst nach K33 (4 s) und überleben einen Neustart (settings.json, kontoUebergang); huelle-kern.ts, im Verhalten geprüft.
 */
const uebergang = erzeugeUebergang({
  speicher: { lies: leseKontoUebergang, schreib: schreibeKontoUebergang },
  jetzt: () => Date.now(),
  wecker,
  melde: (message) => emit({ type: 'notice', message }),
  log: (z) => log?.warn(z),
});

/**
 * Haken an beiErsterAnmeldung (N5, EP12): den gespeicherten GitHub-Zugang löschen; Downloads laufen ab jetzt über die
 * Sitzung. Der Konto-Dialog zeigt K32 als Hinweis (P25). Die Meldung kommt erst nach dem nächsten Laden der Tokens, zusammen
 * mit I11: Eine Meldung hier würde die Meldung K33, die die Hülle direkt danach zeigt, sofort überdecken.
 */
function nachErsterAnmeldungAufraeumen(): void {
  // Z1: die Vormerkung steht auch dann, wenn das Löschen wirft (der Haken-Aufrufer fängt den Fehler; der Start holt es nach).
  let geloescht = false;
  try {
    geloescht = loescheGithubZugang();
  } finally {
    if (geloescht) treiber?.merkeHinweis('github-geloescht');
    uebergang.vormerken(geloescht);
  }
}

/**
 * OFP1, IV5: lokal gespeicherte iveo-Tokens nach der ersten Anmeldung löschen — je Event, sobald der Worker es diesem Konto
 * liefert, sonst spätestens 30 Tage nach der ersten Anmeldung; nie, solange eine iveo-Show offen ist (dann beim nächsten
 * Lauf: ladeIveo ruft ihn nach jedem Laden, also beim Start, nach der Anmeldung und alle 5 min). Ohne geladene Tokens zählt
 * kein Event als zentral hinterlegt. Ins Log nur Anzahlen, nie Schlüssel oder Werte (G4).
 */
function raeumeLokaleIveoTokensAuf(): void {
  try {
    const erste = leseKontoErsteAnmeldung();
    if (erste === null) return;
    const r = lokaleLoeschen({
      lokaleSlugs: listIveoTokenKeys(),
      zentral: iveoGeladen ? zentraleKeysFuerLoeschlauf(iveo.erlaubteEvents()) : [],
      ersteAnmeldung: erste,
      jetzt: Date.now(),
      iveoShowOffen: iveoShowOffen(),
      standardBasis: resolveIveoBaseUrl(),
    });
    if (r.markieren.length) markiereAbgleichHier(r.markieren);
    if (r.loeschen.length) {
      loescheLokaleIveoTokens(r.loeschen);
      log?.info(`Anmeldung: ${r.loeschen.length} lokal gespeicherte iveo-Tokens gelöscht (OFP1)`);
    }
    if (iveoGeladen) {
      uebergang.nachLaden((github) => uebergangsText({
        github, bleiben: r.bleiben, spaetestens: r.spaetestens, textGithub: TEXT_GITHUB_GELOESCHT, textLokal: textLokaleIveo,
      }));
    }
  } catch (e) {
    // Ein Fehler hier (z. B. EPERM/EBUSY beim Schreiben) darf ladeIveo nicht abbrechen; nur der Fehlername ins Log (G4).
    log?.warn(`Anmeldung: Aufräumen lokaler iveo-Tokens fehlgeschlagen (${(e as Error)?.name ?? 'Error'})`);
  }
}

// N5: der Haken hängt an der ersten Anmeldung (Task 21 ruft ihn nur, wenn kontoErsteAnmeldung fehlte).
beiErsterAnmeldung.push(nachErsterAnmeldungAufraeumen);

/** EP15: Lage beim Start, alle 5 min und bei Fensterfokus (höchstens einmal je Minute). */
async function kontoLage(fokus: boolean): Promise<void> {
  if (!treiber) return;
  const jetzt = Date.now();
  if (fokus && jetzt - letzteLage < LAGE_FOKUS_MS) return;
  letzteLage = jetzt;
  await treiber.lage();
  // P23 (EP13): danach die iveo-Tokens — auch später hinterlegte Events, und nachgeholt, wenn der Start offline war.
  await ladeIveo();
}

/** Admin laut festgehaltenem Stand; die Admin-Routen prüfen am Worker zusätzlich den aktuellen Stand (OFP4). */
function istAdmin(): boolean {
  return kontoSitzungMoeglich() && kontoAnsichtJetzt().stand?.stufe === 'admin';
}

/**
 * EP35 (Nachbesserung Block D, sicherheit:8): der System-Browser bekommt nur https-Adressen des Workers (in der Entwicklung http
 * auf der Loopback-Adresse). Der Client verwirft andere Anmeldeadressen schon (K53); das hier ist die zweite Sperre direkt vor
 * shell.openExternal — file:, ms-…: und fremde Hosts gehen nie hinaus. Die Logzeile nennt die Adresse nicht.
 */
function oeffneImBrowser(url: string): Promise<boolean> {
  // Z1: geöffnet wird die Form, die URL selbst ausgibt (browserHref), nie die Rohzeichenkette.
  const href = browserHref(url, serverBasis);
  if (href === null) {
    log?.warn('Anmeldung: Anmeldeadresse nicht geöffnet (nicht beim Worker oder ohne https)');
    return Promise.resolve(false);
  }
  return shell.openExternal(href).then(() => true, () => false);
}

/** Lazy: der Ablauf entsteht beim ersten „Anmelden“, dann ist der Rechnername des Verbunds geladen (EP7). */
function anmeldeAblauf(): AnmeldeAblauf | null {
  if (ablauf || !client || !treiber) return ablauf;
  const t = treiber;
  ablauf = erzeugeAnmeldeAblauf({
    client,
    geraet: async () => geraet,
    jetzt: () => Date.now(),
    wecker,
    oeffneBrowser: oeffneImBrowser,
    rechnerName: rechnerName(),
    plattform: plattform(),
    arch: arch(),
    version: app.getVersion(),
    angemeldet: (s) => t.angemeldet(s),
    // AA6: der Schritt (mit Code) geht nur an den Renderer, nie ins Log.
    melde: (schritt) => emit({ type: 'anmeldung-changed', schritt }),
  });
  return ablauf;
}

async function zoomAnfragen(roh: unknown): Promise<KontoZoomAntwort> {
  const a = roh as { zweck?: unknown; von?: unknown; bis?: unknown } | null;
  if (!a || typeof a.zweck !== 'string' || typeof a.von !== 'number' || typeof a.bis !== 'number') return { ok: false, code: 'ungueltig' };
  const t = await kontoSitzungFuerBedarf();
  if (!t || !client || !treiber) return { ok: false, code: 'nicht-angemeldet' };
  try {
    await client.zoomAnfragen(t, { zweck: a.zweck, von: a.von, bis: a.bis });
    await treiber.lage();
    return { ok: true, ansicht: kontoAnsichtJetzt() };
  } catch (e) {
    return { ok: false, code: fehlerCode(e) };
  }
}

async function adminUebersicht(): Promise<KontoAdminAntwort> {
  const t = await kontoSitzungFuerBedarf();
  if (!t || !client) return { ok: false, code: 'nicht-angemeldet' };
  if (!istAdmin()) return { ok: false, code: 'kein-recht' };
  try {
    return { ok: true, daten: await client.adminUebersicht(t) };
  } catch (e) {
    return { ok: false, code: fehlerCode(e) };
  }
}

const ADMIN_AKTIONEN: readonly string[] = ['zugang-speichern', 'einladen', 'neuer-code', 'zugang-loeschen', 'entsperren',
  'iveo-hinterlegen', 'iveo-entfernen', 'anfrage-freigeben', 'anfrage-ablehnen', 'geraet-markieren'];

async function adminAktion(roh: unknown): Promise<KontoAdminAktionAntwort> {
  const a = roh as AdminAktion | null;
  if (!a || typeof a !== 'object' || !ADMIN_AKTIONEN.includes((a as { aktion?: unknown }).aktion as string)) return { ok: false, code: 'ungueltig' };
  const t = await kontoSitzungFuerBedarf();
  if (!t || !client || !treiber) return { ok: false, code: 'nicht-angemeldet' };
  if (!istAdmin()) return { ok: false, code: 'kein-recht' };
  // OE2 (Z1): ein Token wird nur für eine Basis der festen iveo-Liste hinterlegt; sonst geht nichts an den Worker.
  let aktion: AdminAktion = a;
  if (a.aktion === 'iveo-hinterlegen') {
    const basis = iveoHinterlegenBasis(a.basis, resolveIveoBaseUrl());
    if (basis === null) return { ok: false, code: 'iveo-basis-unbekannt' };
    aktion = { ...a, basis };
  }
  const c = client;
  const tr = treiber;
  // Z1: das Ergebnis der Aktion (Einladungscode) erreicht den Aufrufer auch, wenn die Übersicht danach scheitert.
  return adminAktionAusfuehren({
    aktion: () => c.adminAktion(t, aktion),
    uebersicht: () => c.adminUebersicht(t),
    // Der Punkt am Zahnrad (offene Anfragen) folgt der Aktion sofort.
    lage: () => tr.lage(),
    fehlerCode,
  });
}

/**
 * konto:iveoEventsLaden (10.7, EP13): Discovery für den Reiter „iveo-Events“ der Admin-Maske. Das Token kommt aus dem
 * Formular, geht nur an iveo und nie zurück; gespeichert wird hier nichts (das Hinterlegen läuft über adminAktion).
 */
async function iveoEventsLaden(roh: unknown): Promise<KontoIveoEventsAntwort> {
  const a = roh as { basis?: unknown; token?: unknown } | null;
  if (!a || typeof a.basis !== 'string' || typeof a.token !== 'string' || !a.token.trim()) return { ok: false, fehler: TEXT_TOKEN_FEHLT };
  if (!istAdmin()) return { ok: false, fehler: TEXT_KEIN_ADMIN };
  try {
    const iveoClient = new IveoClient({
      token: a.token.trim(),
      baseUrl: a.basis.trim() || resolveIveoBaseUrl(),
      fetchImpl: mitZeitgrenze((url, init) => fetch(url, init), IVEO_ABRUF_ZEITGRENZE_MS),
    });
    const events = await iveoClient.discovery();
    return { ok: true, events: eventsFuerRenderer(events) };
  } catch (e) {
    const f = toClientError(e);
    log?.warn(`Anmeldung: iveo-Events nicht geladen (${f.code ?? 'fehler'})`);
    return { ok: false, fehler: f.error };
  }
}

/** IPC nach 10.7 (registriert aus ipc.ts). Keine Antwort enthält eine Sitzung, eine Freigabe oder ein iveo-Token. */
export function registriereKontoIpc(ipc: IpcMain): void {
  ipc.handle('konto:ansicht', async (): Promise<KontoAnsicht> => {
    await treiberBereit;
    return kontoAnsichtJetzt();
  });
  ipc.handle('konto:anmelden', async (): Promise<AnmeldeSchritt> => {
    await treiberBereit;
    const a = anmeldeAblauf();
    // Z1 (G7): der Fehlercode nennt den wahren Grund (ohne Schlüsselspeicher oder sonst der Server), nicht immer den Schlüsselspeicher.
    if (!a) return anmeldenOhneAblauf(kontoAnsichtJetzt().zustand);
    // EP26: „Anmelden“ gibt es nur ohne gültige Sitzung — ein Konto je Rechner.
    if (kontoToken() === null) await a.starte();
    return a.schritt();
  });
  ipc.handle('konto:anmeldeSchritt', (): AnmeldeSchritt => ablauf?.schritt() ?? { art: 'ruhe' });
  ipc.handle('konto:anmeldenAbbrechen', async (): Promise<AnmeldeSchritt> => {
    await ablauf?.abbrechen();
    return ablauf?.schritt() ?? { art: 'ruhe' };
  });
  ipc.handle('konto:adresseKopieren', (): boolean => {
    const adresse = ablauf?.adresse();
    // EP35: in die Zwischenablage nur, was auch der Browser bekäme.
    const href = adresse ? browserHref(adresse, serverBasis) : null;
    if (href === null) {
      if (adresse) log?.warn('Anmeldung: Anmeldeadresse nicht kopiert (nicht beim Worker oder ohne https)');
      return false;
    }
    clipboard.writeText(href);
    return true;
  });
  ipc.handle('konto:abmelden', async (): Promise<KontoAnsicht> => {
    await treiberBereit;
    await treiber?.abmelden();
    return kontoAnsichtJetzt();
  });
  ipc.handle('konto:lage', async (): Promise<KontoAnsicht> => {
    await kontoLage(true);
    return kontoAnsichtJetzt();
  });
  ipc.handle('konto:zoomAnfragen', (_e, a: unknown) => zoomAnfragen(a));
  ipc.handle('konto:adminUebersicht', () => adminUebersicht());
  ipc.handle('konto:adminAktion', (_e, a: unknown) => adminAktion(a));
  ipc.handle('konto:iveoEventsLaden', (_e, a: unknown) => iveoEventsLaden(a));
  ipc.handle('konto:iveoEvents', (): KontoIveoEvent[] => iveo.erlaubteEvents());
}
