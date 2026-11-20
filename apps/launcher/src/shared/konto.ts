// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · gemeinsame Typen und Rechte (Plan 10.5; Spec 4.2, 5, 9.1; EP16).
// Main und Renderer laden diese Datei. Sie hat darum keinen einzigen Import: nur Typen und reine Funktionen (G9).
// `darf` folgt denselben Regeln wie services/release-proxy/konto-kern.js; test/konto-rechte.test.ts prüft beide an
// derselben Falltabelle (services/release-proxy/test/rechte-faelle.json); `zweckDarf` (Teil 2) an einer zweiten
// (services/release-proxy/test/zweck-faelle.json). `kurzName` ist wortgleich mit dem Worker.
// Alle Zeiten sind Unix-ms.
// ─────────────────────────────────────────────────────────────────────────────

export type Stufe = 'admin' | 'kollege' | 'externer';
export type Werkzeug = 'connect-raum' | 'qa' | 'iveo';
export type Anmeldeart = 'google' | 'passwort';
/** Zwecke einer Freigabe (Teil 2: drei für JM Connect). */
export type Zweck = 'qa-relay' | 'connect-raum' | 'zoom-jwt' | 'zoom-sdk';
export type Funktion = 'launcher-update' | 'katalog' | 'kochbuch' | 'feedback' | 'ki-entwurf' | 'connect-raum' | 'zoom' | 'qa' | 'iveo' | 'admin';
export interface KontoStand {
  kid: string; email: string; name: string; art: Anmeldeart; stufe: Stufe; tools: Werkzeug[]; events: string[];
  zoom: boolean; zoomBis: number | null; jm: boolean; plattform: 'win' | 'mac'; gid: string;
  iat: number; exp: number; kontoBis: number | null; angemeldetSeit: number;
}
export type KontoZustand =
  | 'nicht-angemeldet' | 'pruefe' | 'angemeldet' | 'offline' | 'server-nicht-erreichbar'
  | 'abgelaufen' | 'entzogen' | 'entzogen-laeuft' | 'kein-schluesselspeicher';
export type EntzugGrund = 'gesperrt' | 'geloescht' | 'zugang-abgelaufen' | 'geraet-unbekannt';
/** Warum eine Anmeldung abgelaufen ist: 30 Tage, „Zugang bis“ beim Start, oder die letzte Anmeldung mit Google ist 90 Tage her (OFP8). */
export type AblaufGrund = 'dreissig-tage' | 'zugang-bis' | 'google-neu';
/** Warum die Prüfung beim Server scheitert, obwohl er antwortet (Zustand „server-nicht-erreichbar“, EP30, EP31): Anmeldung dort nicht eingerichtet, Uhr des Rechners falsch. */
export type StoerGrund = 'nicht-eingerichtet' | 'uhr';
export interface ZoomAnfrageStand { id: string; zustand: 'offen' | 'freigegeben' | 'abgelehnt'; zweck: string; von: number; bis: number; am: number }
export interface FreigabeAusgabe { appId: string; zweck: string; ziel: string; bis: number; am: number }
export interface KontoAnsicht {
  zustand: KontoZustand; stand: KontoStand | null; grund: EntzugGrund | AblaufGrund | StoerGrund | null;
  gueltigBis: number | null; rechnerName: string; plattform: 'win' | 'mac';
  hinweise: Array<'sitzung-unlesbar' | 'geraet-neu' | 'github-geloescht'>; devVariablen: string[];
  zoomAnfrage: ZoomAnfrageStand | null; adminOffen: number; ausgaben: FreigabeAusgabe[]; letztePruefung: number | null;
}
export type KontoFehlerCode = 'netz' | 'server' | 'nicht-eingerichtet' | 'zu-viele' | 'nicht-angemeldet' | 'sitzung-abgelaufen'
  | 'kein-recht' | 'gesperrt' | 'geloescht' | 'zugang-abgelaufen' | 'geraet-unbekannt' | 'vorgang-unbekannt' | 'ungueltig'
  | 'konflikt' | 'nicht-noetig' | 'unbekannter-zweck' | 'erster-admin' | 'domain' | 'uhr' | 'iveo-basis-unbekannt';
export type AnmeldeSchritt =
  | { art: 'ruhe' } | { art: 'startet' }
  | { art: 'wartet'; code: string; adresse: string; bis: number; browserOffen: boolean }
  | { art: 'fertig'; kurzName: string; stufe: Stufe }
  | { art: 'abgelehnt' } | { art: 'abgelaufen' } | { art: 'abgebrochen' }
  // Z2 Fixrunde 1 (AR91 Nr. 3): `rueckkanal` = der Rückkanal auf 127.0.0.1 ließ sich nicht öffnen (Dialog K58).
  | { art: 'fehler'; code: KontoFehlerCode | 'kein-schluesselspeicher' | 'browser' | 'rueckkanal' };
export interface AdminZugang { kid: string; email: string; name: string; art: Anmeldeart; stufe: Stufe; zustand: 'aktiv' | 'gesperrt';
  tools: Werkzeug[]; events: string[]; bis: number | null; zoomBis: number | null; einladungBis: number | null;
  letzteAnmeldung: number | null; ersterAdmin: boolean }
export interface AdminIveoEvent { key: string; basis: string; slug: string; name: string; am: number; von: string }
export interface AdminAnfrage { id: string; kid: string; name: string; email: string; zweck: string; von: number; bis: number;
  gid: string; rechnerName: string; jm: boolean; plattform: 'win' | 'mac'; zustand: 'offen' | 'freigegeben' | 'abgelehnt'; am: number }
export interface AdminGeraet { gid: string; name: string; plattform: 'win' | 'mac'; arch: string; version: string; jm: boolean;
  ersterKontakt: number; letzterKontakt: number; letztesKonto: string | null }
export interface AltKeyZeile { tag: string; gruppe: 'katalog' | 'qa' | 'connect'; plattform: string; anzahl: number; zuletzt: number }
export interface AdminUebersicht { zugaenge: AdminZugang[]; iveo: AdminIveoEvent[]; anfragen: AdminAnfrage[]; geraete: AdminGeraet[];
  altKey: { bis: string | null; diagnose: 'ohne-ende' | 'unlesbar' | null; zeilen: AltKeyZeile[];
    connect?: { bis: string | null; diagnose: 'ohne-ende' | 'unlesbar' | null } } }
export type AdminAktion =
  | { aktion: 'zugang-speichern'; kid: string; stufe: Stufe; tools: Werkzeug[]; events: string[]; bis: number | null; zoomBis: number | null }
  | { aktion: 'einladen'; email: string; name: string; tools: Werkzeug[]; events: string[]; bis: number }
  | { aktion: 'neuer-code'; kid: string } | { aktion: 'zugang-loeschen'; kid: string } | { aktion: 'entsperren'; kid: string }
  | { aktion: 'iveo-hinterlegen'; basis: string; events: Array<{ slug: string; name: string }>; token: string }
  | { aktion: 'iveo-entfernen'; key: string }
  | { aktion: 'anfrage-freigeben'; id: string; bis: number } | { aktion: 'anfrage-ablehnen'; id: string }
  | { aktion: 'geraet-markieren'; gid: string; jm: boolean };
export interface AdminAktionErgebnis { ok: true; einladungscode?: string; codeBis?: number }

/** K5: Namen der Stufen in Kopf, Konto-Dialog und Admin-Maske (Texttabelle 9.1). */
export const STUFE_TEXT: Readonly<Record<Stufe, string>> = { admin: 'Admin', kollege: 'Kollege', externer: 'Externer' };

/**
 * Darf dieser Stand diese Funktion (Plan 10.2, Spec 9.1)? Ohne Stand oder mit abgelaufener Sitzung nur das Selbst-Update.
 * Katalog, Kochbuch, Feedback: jede Stufe. KI-Entwurf: Admin, Kollege. Admin-Maske: Admin. Connect-Raum und Q&A: Admin,
 * Kollege, Externe mit dem Werkzeug. iveo (`event` = `basis|slug`): Admin und Kollege jedes Event, Externe nur mit Werkzeug
 * und freigegebenem Event. Zoom nur unter Windows: Admin und Kollege immer (OF1), Externe nur mit Freigabe auf einem
 * JM-Rechner (OF4).
 */
export function darf(stand: KontoStand | null, f: Funktion, k: { event?: string; jetzt: number }): boolean {
  if (f === 'launcher-update') return true;
  if (!stand || !(stand.exp > k.jetzt)) return false;
  const stufe = stand.stufe;
  if (stufe !== 'admin' && stufe !== 'kollege' && stufe !== 'externer') return false;
  const intern = stufe === 'admin' || stufe === 'kollege';
  const tools: readonly string[] = Array.isArray(stand.tools) ? stand.tools : [];
  const events: readonly string[] = Array.isArray(stand.events) ? stand.events : [];
  switch (f) {
    case 'katalog':
    case 'kochbuch':
    case 'feedback':
      return true;
    case 'ki-entwurf':
      return intern;
    case 'admin':
      return stufe === 'admin';
    case 'connect-raum':
    case 'qa':
      return intern || tools.includes(f);
    case 'iveo':
      return intern || (tools.includes('iveo') && typeof k.event === 'string' && events.includes(k.event));
    case 'zoom':
      if (stand.plattform !== 'win') return false;
      return intern || (stand.zoom === true && stand.jm === true);
    default:
      return false;
  }
}

/** Welche Funktion ein Zweck verlangt (wie ZWECK_FUNKTION am Worker). */
export const ZWECK_FUNKTION: Readonly<Record<Zweck, Funktion>> = {
  'qa-relay': 'qa', 'connect-raum': 'connect-raum', 'zoom-jwt': 'zoom', 'zoom-sdk': 'zoom',
};

/**
 * Darf dieser Stand diesen Zweck (Teil 2, OT4)? Gleiche Regel wie `zweckDarf` am Worker. Unbekannter Zweck: kein Recht.
 * `zoom-sdk` braucht außerdem einen JM-Rechner: erst „dürfte er Zoom auf einem JM-Rechner?“ (P1), sonst `kein-recht`;
 * dann die Markierung des Geräts, sonst `kein-jm-rechner`.
 */
export function zweckDarf(stand: KontoStand | null, zweck: string, k: { jetzt: number }): 'ja' | 'kein-recht' | 'kein-jm-rechner' {
  if (typeof zweck !== 'string' || !Object.prototype.hasOwnProperty.call(ZWECK_FUNKTION, zweck)) return 'kein-recht';
  if (zweck === 'zoom-sdk') {
    if (!stand || typeof stand !== 'object' || !darf({ ...stand, jm: true }, 'zoom', k)) return 'kein-recht';
    return stand.jm !== true ? 'kein-jm-rechner' : 'ja';
  }
  return darf(stand, ZWECK_FUNKTION[zweck as Zweck], k) ? 'ja' : 'kein-recht';
}

/** Vorname plus Initial des letzten Worts („Maria S.“); ein Wort bleibt; ohne Namen der Teil der E-Mail vor dem @. */
export function kurzName(name: string, email: string): string {
  const woerter = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  if (woerter.length >= 2) return `${woerter[0]} ${[...woerter[woerter.length - 1]][0].toUpperCase()}.`;
  if (woerter.length === 1) return woerter[0];
  const e = typeof email === 'string' ? email.trim() : '';
  const at = e.indexOf('@');
  return at > 0 ? e.slice(0, at) : e;
}

// ── Ende des Moduls ──
