// ─────────────────────────────────────────────────────────────────────────────
// Zoom-Kern (Stage 4a, Spec 5.2–7.5) — OHNE Electron, per tsx gegen die echte Bridge und die
// Attrappe getestet (test/zoom-kern.test.ts). zoom.ts ist die dünne Electron-Hülle darüber
// (IPC, Dialoge, safeStorage, Tray). Muster: Master-Link Teil 2a (verbund/kern.ts).
//
// Der Kern hält Zustand, Mängel der Einrichtung, die laufende Bridge samt Generation (6.9),
// Quellen, Soll-Liste und Meldung. Er fasst kein Electron an und liest keine Einstellung selbst.
//
// GEHEIMNISSE (Spec 5.7, 8.7): Meeting-Nummer und Kenncode leben nur in `nummer`/`kenncode`
// und gehen nur in den join-Befehl. Jede stderr-Zeile der Bridge läuft durch `maskiere`.
// Client-ID/Secret gehen nur in buildJwt, nie an den Kindprozess (envRemove).
//
// 4a (Spec 18): KEIN automatischer Wiederbeitritt. Jeder Auslöser aus 6.4, der einen
// Wiederbeitritt starten würde, führt sofort zu `fehler` mit „Erneut beitreten“.
// ─────────────────────────────────────────────────────────────────────────────

import { readCredentials, type Bridge, type BridgeOptions } from '@jm/zoom-bridge';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import type {
  ProxyKeySource,
  ZoomAbbild,
  ZoomErgebnis,
  ZoomErlaubnis,
  ZoomKurz,
  ZoomMangel,
  ZoomQuelle,
  ZoomZustand,
} from '../../shared/types';
import { stateKvAus, type ZoomStateKv } from '../../shared/zoom-text';
import { KT, mangelText } from './klartext';
import {
  pruefeLaufzeit,
  pruefeSdkOrdner,
  richteEin,
  type EinrichtungsErgebnis,
  type KopieStand,
  type LaufzeitPfade,
  type LaufzeitPruefung,
  type SdkWahl,
} from './laufzeit';
import type { SollListe } from './soll';
import { zaehleQuellen } from './teilnehmer';

/** Spec 5.2. Für Tests einspeisbar (`fristen`); `abgleichMs` bleibt in den Fällen 14/14b bei 300. */
export const ZOOM_FRISTEN = {
  anmeldeMs: 30_000,
  joinTimeoutMs: 30_000,
  killTimeoutMs: 12_000,
  abgleichMs: 300,
  aboAntwortMs: 10_000,
  abbildTaktMs: 100,
  unsubscribeWarteMs: 2_000,
} as const;
export type ZoomFristen = { [K in keyof typeof ZOOM_FRISTEN]: number };
export const BEENDEN_FRIST_MS = 15_000;
export const JWT_GUELTIG_S = 43_200;
export const BETRIEBSGROESSE = 5;
export const AUFLOESUNG = '720p' as const;
export const HINWEISE_MAX = 5;
export const ANZEIGENAME_VORGABE = 'JM Connect';

export type BridgeArt = Pick<Bridge, 'start' | 'send' | 'stop' | 'session'>;
export type BridgeFabrik = (opts: BridgeOptions, startNr: number) => BridgeArt;
export interface ZugangDaten { clientId: string; clientSecret: string }
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; unlesbar: boolean }
export interface LaufzeitDienste {
  pruefe(p: LaufzeitPfade): LaufzeitPruefung;
  pruefeOrdner(gewaehlt: string, ressourcen: string): SdkWahl;
  richteEin(e: Parameters<typeof richteEin>[0]): Promise<EinrichtungsErgebnis>;
}
export interface ZoomKernAbhaengigkeiten {
  pfade: LaufzeitPfade;
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): void };
  einstellungen: {
    anzeigename(): string;
    setzeAnzeigename(n: string): void;
    versatzMs(): number;
    setzeVersatzMs(ms: number): void;
    setzeLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void;
  };
  gastLabels(): string[];
  /** Fertige Zeile mit Präfix, schon maskiert. */
  log(zeile: string): void;
  /** Gedrosselt (höchstens alle `abbildTaktMs`, der letzte Stand kommt immer an). */
  onAbbild(a: ZoomAbbild): void;
  /** Sofort, sobald sich die Kurzform ändert. */
  onKurz?(k: ZoomKurz): void;
  /** Vorgabe: (o) => new Bridge(o). */
  bridgeFabrik?: BridgeFabrik;
  /** Vorgabe: die echten Funktionen aus laufzeit.ts. */
  laufzeit?: Partial<LaufzeitDienste>;
  /** Vorgabe: process.env. */
  env?: Record<string, string | undefined>;
  fristen?: Partial<ZoomFristen>;
}
export interface ZoomKern {
  abbild(): ZoomAbbild;
  kurz(): ZoomKurz;
  stateKv(): ZoomStateKv | null;
  laeuft(): boolean;
  einrichtungSperre(): ZoomErgebnis;
  sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  zugangWaehlen(datei: string): ZoomErgebnis;
  zugangLoeschen(): ZoomErgebnis;
  versatz(e: { ms: number }): ZoomErgebnis;
  schliessen(): void;
  meldungWeg(): void;
  gastLabelsGeaendert(): void;
  beenden(fristMs: number): Promise<void>;
}

/** Eine Quelle samt der Generation der Bridge, die sie meldet (6.9). */
interface QuelleIntern extends ZoomQuelle { gen: number }

function zeitgeber(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  t.unref?.();
  return t;
}

export function erzeugeZoomKern(d: ZoomKernAbhaengigkeiten): ZoomKern {
  const f: ZoomFristen = { ...ZOOM_FRISTEN, ...d.fristen };
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };

  // ── Zustand ──────────────────────────────────────────────────────────────
  let zustand: ZoomZustand = 'bereit';
  /** Nur in `warteraum` gesetzt (Spec 6.2 Schritt 5). */
  let warten: 'warteraum' | 'host' | null = null;
  /** Gilt nur in `im_meeting` (Spec 6.2 Schritt 6). */
  let erlaubnis: ZoomErlaubnis = 'offen';
  let maengel: ZoomMangel[] = [];
  let laufzeitStand: LaufzeitPruefung = lz.pruefe(d.pfade);
  let zugang: ZugangStand = { daten: null, herkunft: 'none', unlesbar: false };
  let zugangFehler: string | null = null;
  let sdkFehler: string | null = null;
  let kopie: KopieStand | null = null;
  let kopieAbbruch: AbortController | null = null;
  /** Das laufende richteEin; beenden wartet darauf, damit `.teil` gelöscht ist (Spec 6.1, 6.6). */
  let kopieLauf: Promise<EinrichtungsErgebnis> | null = null;
  let pruefungLaeuft = false;
  let meldung: ZoomAbbild['meldung'] = null;
  const hinweise: string[] = [];
  /** Nur im Arbeitsspeicher (Spec 5.7). */
  let nummer: { eingabe: string; normiert: string } | null = null;
  let kenncode: string | null = null;
  /** Merker „war im Meeting“ (Ergänzung 0.10); 4b entscheidet daran über den Wiederbeitritt. */
  let warImMeeting = false;
  const soll: SollListe = new Map();
  const quellen = new Map<number, QuelleIntern>();
  let beendenVersprechen: Promise<void> | null = null;

  // ── Abbild und Drossel ───────────────────────────────────────────────────
  let letzterPush = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let letzteKurz = '';

  function kurz(): ZoomKurz {
    const { n, k } = zaehleQuellen(quellen.values());
    return {
      zustand,
      warten: zustand === 'warteraum' ? warten : null,
      erlaubnis: zustand === 'im_meeting' ? erlaubnis : null,
      quellen: n,
      ohneBild: k,
      sollOffen: 0,
      versuch: null,
      maengel: [...maengel],
      kopieLaeuft: kopie !== null,
    };
  }

  function abbild(): ZoomAbbild {
    const l = laufzeitStand;
    const stand = kopie !== null ? 'kopiert' : !l.ok && l.mangel === 'sdk_fehlt' ? 'fehlt' : !l.ok && l.mangel === 'sdk_defekt' ? 'defekt' : 'ok';
    const sdkText = sdkFehler ?? (!l.ok && (l.mangel === 'sdk_defekt' || l.mangel === 'bridge_fehlt') ? mangelText(l.mangel, mangelDatei()) : null);
    const zugangText = !zugang.daten && zugang.unlesbar ? KT.A5
      : zugang.herkunft === 'session' ? KT.A4
      : zugang.herkunft === 'env' ? KT.A6
      : zugangFehler;
    const id = zugang.daten?.clientId ?? null;
    return {
      kurz: kurz(),
      einrichtung: {
        sdk: { stand, fassung: stand === 'ok' ? SDK_FASSUNG : null, kopie: kopie ? { ...kopie } : null, text: sdkText },
        zugang: { herkunft: zugang.herkunft, clientIdEnde: id ? id.slice(-4) : null, text: zugangText },
      },
      anzeigename: d.einstellungen.anzeigename(),
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: null },
      teilnehmer: [],
      soll: [],
      abriss: null,
      meldung: meldung ? { ...meldung } : null,
      hinweise: [...hinweise],
      erneutMoeglich: nummer !== null,
      pruefungLaeuft,
    };
  }

  /** Nach jeder Änderung: Kurzform sofort (bei Änderung), Abbild höchstens alle abbildTaktMs. */
  function abbildGeaendert(): void {
    const k = kurz();
    const kj = JSON.stringify(k);
    if (kj !== letzteKurz) {
      letzteKurz = kj;
      d.onKurz?.(k);
    }
    if (pushTimer !== null) return;
    const rest = letzterPush + f.abbildTaktMs - Date.now();
    if (rest <= 0) {
      letzterPush = Date.now();
      d.onAbbild(abbild());
      return;
    }
    pushTimer = zeitgeber(rest, () => {
      pushTimer = null;
      letzterPush = Date.now();
      d.onAbbild(abbild());
    });
  }

  function setzeZustand(z: ZoomZustand): void {
    if (z !== zustand) {
      d.log(`[zoom] Zustand ${zustand} → ${z}`);
      zustand = z;
    }
    if (z !== 'warteraum') warten = null;
    abbildGeaendert();
  }

  // ── Einrichtung (Spec 5.3, 6.1) ──────────────────────────────────────────
  /** Mängel neu bestimmen: Laufzeit-Mangel zuerst, dann Zugangs-Mangel. */
  function bestimmeMaengel(neu?: LaufzeitPruefung): void {
    if (neu) {
      laufzeitStand = neu;
      meldeLaufzeit(neu);
    }
    zugang = d.zugang.lesen();
    const m: ZoomMangel[] = [];
    if (!laufzeitStand.ok) m.push(laufzeitStand.mangel);
    if (!zugang.daten) m.push(zugang.unlesbar ? 'zugang_unlesbar' : 'zugang_fehlt');
    maengel = m;
  }

  /** Spec 8.7: die Diagnose der Laufzeit-Prüfung (Grund, warum eine eigene Datei nicht ersetzt werden konnte) gehört ins Log. */
  function meldeLaufzeit(l: LaufzeitPruefung): void {
    if (!l.ok && l.mangel === 'sdk_defekt' && l.detail) d.log(`[zoom] Laufzeit defekt: ${l.datei} (${l.detail})`);
    if (l.ok && l.ersetzt.length) d.log(`[zoom] Eigene Dateien ersetzt: ${l.ersetzt.join(', ')}`);
  }

  function mangelDatei(): string | null {
    return !laufzeitStand.ok && laufzeitStand.mangel === 'sdk_defekt' ? laufzeitStand.datei : null;
  }

  function einrichtungSperre(): ZoomErgebnis {
    const frei = (zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler';
    return frei ? { ok: true } : { ok: false, text: KT.S10 };
  }

  async function sdkWaehlen(ordner: string): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    sdkFehler = null;
    const wahl = lz.pruefeOrdner(ordner, d.pfade.ressourcen);
    if (!wahl.ok) {
      sdkFehler = wahl.text;
      d.log(`[zoom] SDK-Ordner abgewiesen: ${wahl.text}`);
      abbildGeaendert();
      return { ok: false, text: wahl.text };
    }
    const abbruch = new AbortController();
    kopieAbbruch = abbruch;
    kopie = { dateien: 0, dateienGesamt: wahl.dateien.length, bytes: 0, bytesGesamt: wahl.bytesGesamt };
    d.log(`[zoom] Zoom-SDK ${wahl.fassung} wird kopiert (${wahl.dateien.length} Dateien)`);
    setzeZustand('einrichtung');
    let erg: EinrichtungsErgebnis;
    try {
      kopieLauf = lz.richteEin({
        wahl,
        pfade: d.pfade,
        signal: abbruch.signal,
        fortschritt: (k) => {
          kopie = { ...k };
          abbildGeaendert();
        },
      });
      erg = await kopieLauf;
    } catch (e) {
      erg = { ok: false, text: KT.S6((e as { code?: string }).code ?? (e instanceof Error ? e.message : String(e))) };
    }
    kopie = null;
    kopieAbbruch = null;
    kopieLauf = null;
    if (erg.ok) {
      d.einstellungen.setzeLaufzeit({ dir: erg.ordner, fassung: erg.stempel.sdkFassung, eingerichtetAm: erg.stempel.eingerichtetAm });
      d.log(`[zoom] Zoom-SDK eingerichtet in ${erg.ordner}`);
      if (erg.aufraeumFehler) d.log(`[zoom] Aufräumen nach der Einrichtung unvollständig (${erg.aufraeumFehler})`);
    } else {
      sdkFehler = erg.text;
      d.log(`[zoom] Einrichtung des Zoom-SDK gescheitert: ${erg.text}`);
    }
    bestimmeMaengel(lz.pruefe(d.pfade));
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return erg.ok ? { ok: true } : { ok: false, text: erg.text };
  }

  function zugangWaehlen(datei: string): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    let daten: ZugangDaten;
    try {
      // Mit dieser Umgebung ist die Datei die EINZIGE Quelle (jwt.ts); BOM wird vertragen,
      // ein Parse-Fehler zitiert den Inhalt nicht.
      daten = readCredentials({ ZOOM_SDK_CREDENTIALS: datei });
    } catch (e) {
      const err = e as Error & { code?: string };
      const text = err.message.includes('kein gueltiges JSON') ? KT.A1
        : err.message.includes('Zugangsdaten fehlen') ? KT.A2
        : KT.A3(err.code ?? err.name);
      zugangFehler = text;
      d.log(`[zoom] Zugangsdaten-Datei abgewiesen: ${text}`);
      abbildGeaendert();
      return { ok: false, text };
    }
    zugangFehler = null;
    const herkunft = d.zugang.speichern({ clientId: daten.clientId, clientSecret: daten.clientSecret });
    d.log(`[zoom] Zugangsdaten hinterlegt (${herkunft === 'session' ? 'nur für diese Sitzung' : 'verschlüsselt'})`);
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: true };
  }

  function zugangLoeschen(): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    d.zugang.loeschen();
    zugangFehler = null;
    d.log('[zoom] Zugangsdaten entfernt');
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: true };
  }

  function versatz(e: { ms: number }): ZoomErgebnis {
    if (!Number.isInteger(e.ms) || e.ms < 0 || e.ms > 1000) return { ok: false, text: KT.Q13 };
    d.einstellungen.setzeVersatzMs(e.ms);
    abbildGeaendert();
    return { ok: true };
  }

  /** Spec 6.8 „Schließen“: nur in Z2 und Z13. */
  function schliessen(): void {
    if (zustand !== 'bereit' && zustand !== 'fehler') return;
    meldung = null;
    soll.clear();
    nummer = null;
    kenncode = null;
    warImMeeting = false;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  /** Spec 6.8 „Meldung quittieren“: in jedem Zustand außer Z13. */
  function meldungWeg(): void {
    if (zustand === 'fehler') return;
    meldung = null;
    abbildGeaendert();
  }

  function laeuft(): boolean {
    return kopie !== null || pruefungLaeuft;
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
  /** Wartet höchstens `ms` auf `p` (eine Ablehnung zählt als Ende); true = `p` war rechtzeitig fertig. */
  async function mitFrist(p: Promise<unknown>, ms: number): Promise<boolean> {
    let frist: ReturnType<typeof setTimeout> | null = null;
    const rechtzeitig = await Promise.race([
      p.then(
        () => true,
        () => true,
      ),
      new Promise<boolean>((resolve) => {
        frist = zeitgeber(ms, () => resolve(false));
      }),
    ]);
    if (frist !== null) clearTimeout(frist);
    return rechtzeitig;
  }

  function beenden(fristMs: number): Promise<void> {
    if (beendenVersprechen !== null) return beendenVersprechen;
    beendenVersprechen = (async () => {
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
      abbildGeaendert();
    })();
    return beendenVersprechen;
  }

  // ── Start ────────────────────────────────────────────────────────────────
  bestimmeMaengel();
  zustand = maengel.length ? 'einrichtung' : 'bereit';
  d.log(`[zoom] Zoom-Kern bereit: ${zustand}${maengel.length ? ` (Mängel: ${maengel.join(', ')})` : ''}`);
  meldeLaufzeit(laufzeitStand);
  letzteKurz = JSON.stringify(kurz());

  return {
    abbild,
    kurz,
    stateKv: () => stateKvAus(kurz()),
    laeuft,
    einrichtungSperre,
    sdkWaehlen,
    zugangWaehlen,
    zugangLoeschen,
    versatz,
    schliessen,
    meldungWeg,
    gastLabelsGeaendert: () => abbildGeaendert(),
    beenden,
  };
}
