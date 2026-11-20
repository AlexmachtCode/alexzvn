// ─────────────────────────────────────────────────────────────────────────────
// Zugang von JM Connect über den Launcher (Anmeldung im Launcher, Teil 2; Spec 3, 6.2, 6.3, 10; Entwurf OT1, OT8–OT10, N2).
// Muster: apps/qa/src/main/cloud-zugang.ts.
//
// Connect holt beim laufenden Launcher desselben Windows-Kontos je Zweck eine Freigabe (`connect-raum` mit der Raum-ID als
// Ziel, `zoom-jwt` für die Zoom-Anmeldung, `zoom-sdk` für „Zoom-SDK laden“; je 72 h) und schickt sie als `Authorization:
// Bearer` an den Worker. Reihenfolge des Zugangs: gültige Freigabe für genau dieses Ziel, sonst der alte Key (nur im Übergang),
// sonst keiner. Dieses Modul enthält nur die Regeln und alle Texte der Zeilen „Cloud-Zugang“ und „Zoom-Anmeldung“.
//
// Rein: kein Electron, keine Datei, keine Laufzeit-Importe (nur Typen); läuft unter tsx und node --experimental-strip-types.
// ─────────────────────────────────────────────────────────────────────────────
import type { FreigabeGrund } from '@jm/app-runtime/freigabe';
import type { ProxyKeySource } from '../../shared/types';

export type ConnectZweck = 'connect-raum' | 'zoom-jwt' | 'zoom-sdk';
export const APP_ID = 'jm-connect';
/** Fester Zielwert des Zwecks `zoom-jwt`. */
export const ZIEL_ZOOM_JWT = 'meeting-sdk';
/** Fester Zielwert des Zwecks `zoom-sdk`. */
export const ZIEL_ZOOM_SDK = 'win-x64';
/** Erneuern, sobald weniger als 24 h bleiben (eine Freigabe gilt 72 h). */
export const ERNEUERN_VOR_MS = 86_400_000;
/** Höchstens ein Versuch beim Launcher je 30 s. */
export const FREIGABE_ABSTAND_MS = 30_000;

/** Die Freigabe, wie Connect sie hält (verschlüsselt auf der Platte, nie im Log, nie im Renderer). */
export interface ConnectFreigabe {
  zweck: ConnectZweck;
  token: string;
  bis: number;
  ziel: string;
  konto: { name: string; stufe: 'admin' | 'kollege' | 'externer' };
}
export type GehalteneFreigaben = Partial<Record<ConnectZweck, ConnectFreigabe>>;

export type ZugangsWahl = { art: 'freigabe'; f: ConnectFreigabe } | { art: 'alter-key'; key: string } | { art: 'keiner' };

/** Lage der Zeile „Cloud-Zugang“. */
export interface ZugangsLage {
  wahl: ZugangsWahl['art'];
  konto: ConnectFreigabe['konto'] | null;
  bis: number | null;
  letzterGrund: FreigabeGrund | null;
  detail: string | null;
  altHerkunft: ProxyKeySource;
  altAbgelehnt: boolean;
  versucht: boolean;
  geloescht: boolean;
}

/** Gründe, die nur beim Zoom-JWT hinzukommen (Antwort des Workers auf POST /zoom/jwt). */
export type JwtGrund = FreigabeGrund | 'server-abgelehnt' | 'server-fehler' | 'nicht-eingerichtet';

/** Lage der Zeile „Zoom-Anmeldung“. */
export interface ZoomAnmeldungLage {
  quelle: 'server' | 'lokal' | 'keine';
  grund: JwtGrund | null;
  detail: string | null;
  konto: ConnectFreigabe['konto'] | null;
  freigabeBis: number | null;
  devTtlS: number | null;
  versucht: boolean;
  geloescht: boolean;
}

type Ton = 'ok' | 'warn' | 'fehler';

const ZWECKE: readonly ConnectZweck[] = ['connect-raum', 'zoom-jwt', 'zoom-sdk'];

// ── Regeln ──

/** Gültige Freigabe für genau dieses Ziel vor altem Key (nicht abgelehnt) vor keinem. */
export function waehleZugang(s: { freigabe: ConnectFreigabe | null; ziel: string; altKey: string | null; altAbgelehnt: boolean; jetzt: number }): ZugangsWahl {
  const f = s.freigabe;
  if (f && s.ziel && f.ziel === s.ziel && f.token && f.bis > s.jetzt) return { art: 'freigabe', f };
  const key = s.altKey?.trim() ?? '';
  if (key && !s.altAbgelehnt) return { art: 'alter-key', key };
  return { art: 'keiner' };
}

/** Fällig ohne Freigabe, bei anderem Ziel oder mit weniger als 24 h Rest. */
export function erneuernFaellig(f: ConnectFreigabe | null, ziel: string, jetzt: number): boolean {
  if (!f || f.ziel !== ziel) return true;
  return f.bis - jetzt < ERNEUERN_VOR_MS;
}

/** Höchstens ein Versuch beim Launcher je FREIGABE_ABSTAND_MS. */
export function versuchErlaubt(letzter: number | null, jetzt: number): boolean {
  return letzter === null || jetzt - letzter >= FREIGABE_ABSTAND_MS;
}

/** Kopfzeilen an den Worker: Freigabe als Bearer, alter Key je Zweck im alten Kopf, sonst keine. */
export function zugangsKopf(zweck: ConnectZweck, w: ZugangsWahl): Record<string, string> {
  if (w.art === 'freigabe') return { Authorization: `Bearer ${w.f.token}` };
  if (w.art === 'alter-key') {
    if (zweck === 'connect-raum') return { 'X-Proxy-Key': w.key };
    if (zweck === 'zoom-sdk') return { 'X-Zoom-Sdk-Key': w.key };
  }
  return {};
}

// ── Normalisierer und Ablage ──

/** Nur eine vollständige, zum Zweck passende Freigabe, sonst null; keine fremden Felder. */
export function leseFreigabe(roh: unknown, zweck: ConnectZweck): ConnectFreigabe | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  const k = r.konto as Record<string, unknown> | null | undefined;
  if (r.zweck !== zweck) return null;
  // Token nur aus sichtbaren ASCII-Zeichen (\x21-\x7e): alles andere macht fetch beim Bauen der Kopfzeile zum Wurf und
  // kann den Wert in die Fehlermeldung tragen.
  if (typeof r.token !== 'string' || !/^[\x21-\x7e]+$/.test(r.token) || typeof r.bis !== 'number' || !Number.isFinite(r.bis)) return null;
  if (typeof r.ziel !== 'string' || !r.ziel || typeof k !== 'object' || k === null || typeof k.name !== 'string') return null;
  if (k.stufe !== 'admin' && k.stufe !== 'kollege' && k.stufe !== 'externer') return null;
  return { zweck, token: r.token, bis: r.bis, ziel: r.ziel, konto: { name: k.name, stufe: k.stufe } };
}

/** Alle gehaltenen Freigaben aus dem entschlüsselten Inhalt; Ungültiges und fremde Schlüssel fallen weg. */
export function leseGehalten(roh: unknown): GehalteneFreigaben {
  const o = typeof roh === 'object' && roh !== null ? (roh as Record<string, unknown>) : {};
  const aus: GehalteneFreigaben = {};
  for (const z of ZWECKE) {
    const f = leseFreigabe(o[z], z);
    if (f) aus[z] = f;
  }
  return aus;
}

/** Inhalt der Geheimnis-Datei: nur verschlüsselt. Ohne Schlüsselspeicher null, dann wird nichts geschrieben. */
export function geheimnisDatei(g: GehalteneFreigaben, v: { verfuegbar(): boolean; verschluesseln(t: string): Uint8Array }): Uint8Array | null {
  if (!v.verfuegbar()) return null;
  return v.verschluesseln(JSON.stringify(g));
}

// ── Antworten des Workers ──

/** Der Code einer Fehlerantwort: ein kurzer Text aus [a-z-] (1 bis 40 Zeichen) im Feld `code` eines Objekts, sonst null. */
export function leseFehlerCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const c = (body as { code?: unknown }).code;
  return typeof c === 'string' && /^[a-z-]{1,40}$/.test(c) ? c : null;
}

/** Betrifft die Ablehnung den alten Key selbst? Nur 401 mit `nicht-angemeldet` oder `alter-key-abgelaufen`; ein 403 nie. */
export function altKeyVerworfen(status: number, code: string | null): boolean {
  return status === 401 && (code === 'nicht-angemeldet' || code === 'alter-key-abgelaufen');
}

/**
 * Antwort des Workers auf Freigabe bzw. alten Key. Freigabe: 401 und jedes 403 außer `raum-vergeben` (der Raum gehört einem
 * anderen, die Freigabe ist in Ordnung) → verwerfen. Alter Key: nur wenn der Worker genau diesen Key abgelehnt hat.
 */
export function nachAblehnung(w: ZugangsWahl['art'], status: number, code: string | null): 'freigabe-verwerfen' | 'key-abgelehnt' | null {
  if (w === 'freigabe') {
    if (status === 401) return 'freigabe-verwerfen';
    if (status === 403 && code !== 'raum-vergeben') return 'freigabe-verwerfen';
    return null;
  }
  if (w === 'alter-key') return altKeyVerworfen(status, code) ? 'key-abgelehnt' : null;
  return null;
}

// ── Texte (Texttabelle T3, T4; wörtlich) ──

function zwei(n: number): string {
  return String(n).padStart(2, '0');
}
/** TT.MM.JJJJ in Ortszeit. */
function datumText(ms: number): string {
  const d = new Date(ms);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
}
/** HH:MM in Ortszeit. */
function zeitText(ms: number): string {
  const d = new Date(ms);
  return `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

const STUFE_TEXT: Readonly<Record<ConnectFreigabe['konto']['stufe'], string>> = { admin: 'Admin', kollege: 'Kollege', externer: 'Externer' };

export const ZUGANG_TEXT = {
  /** CZ1 */
  cloudFreigabe: (name: string, stufe: string, datum: string, zeit: string): string => `Cloud-Zugang über den Launcher (${name} · ${stufe}), gültig bis ${datum} ${zeit}.`,
  /** CZ2 */
  cloudAltKey: 'Cloud-Zugang über den alten Proxy-Key (Übergang).',
  /** CZ3 */
  cloudAltAbgelehnt: 'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.',
  /** CZ4 */
  cloudNochNicht: 'Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest.',
  /** CZ5 */
  cloudGeloescht: 'Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers.',
  /** CZ6 */
  cloudEnv: 'Entwicklungsmodus: JMPS_PROXY_KEY gesetzt.',
  /** CZ7 */
  raumNicht: (grund: string): string => `Raum öffnen nicht möglich: ${grund}`,
  /** CZ8 */
  raumVergeben: 'Dieser Cloud-Raum gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort oder wähle im Show-Editor eine andere Raum-ID.',
  /** CZ9 */
  raumFreigabeAbgelehnt: 'Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher; bitte noch einmal „Raum öffnen“.',
  /** CZ10 */
  altProxyKey: 'Alter Proxy-Key: hinterlegt, nur noch im Übergang.',
  /** ZA1 */
  anmeldungServer: (name: string, stufe: string, datum: string, zeit: string): string => `Zoom-Anmeldung über den Launcher (${name} · ${stufe}), Freigabe gültig bis ${datum} ${zeit}.`,
  /** ZA2 */
  anmeldungLokal: 'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang).',
  /** ZA3 */
  anmeldungKeine: (grund: string): string => `Zoom-Anmeldung: ${grund}`,
  /** ZA4 */
  anmeldungNochNicht: 'Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.',
  /** ZA5 */
  zugangGeloescht: 'Die alten Zoom-Zugangsdaten wurden gelöscht; Connect meldet sich jetzt über den Launcher bei Zoom an.',
  /** ZA6 */
  sdkGeloescht: 'Der alte SDK-Schlüssel wurde gelöscht; „Zoom-SDK laden“ läuft jetzt über den Launcher.',
  /** ZA7 */
  ohneAnmeldung: (grund: string): string => `Ohne Zoom-Anmeldung kein Beitritt. ${grund}`,
  /** ZA8 */
  serverAbgelehnt: 'Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher.',
  /** ZA9 */
  nichtEingerichtet: 'Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid.',
  /** ZA10 */
  serverFehler: (detail: string): string => `Der Server hat kein Zoom-Anmelde-Token geliefert (${detail}). Ich versuche es beim nächsten Beitritt erneut.`,
  /** ZA11 */
  entwicklungTtl: (n: number): string => `Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit ${n} s Laufzeit aus.`,
} as const;

/** Texte CG1–CG10 je Grund (CG7 und CG8 hängen vom Zweck ab, CG10 vom Detail). */
const GRUND_TEXT = {
  'kein-launcher': 'Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.', // CG1
  'launcher-unecht': 'Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.', // CG2
  'launcher-zu-alt': 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).', // CG3
  'unbekannter-zweck': 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).', // CG3
  'niemand-angemeldet': 'Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).', // CG4
  abgelaufen: 'Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.', // CG5
  entzogen: 'Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.', // CG6
  'server-nicht-erreichbar': 'Der Server ist gerade nicht erreichbar. Ich versuche es weiter.', // CG9
} as const satisfies Partial<Record<FreigabeGrund, string>>;
const KEIN_RECHT_TEXT: Readonly<Record<ConnectZweck, string>> = {
  'connect-raum': 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.', // CG7a
  'zoom-jwt': 'Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.', // CG7b
  'zoom-sdk': 'Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“).', // CG7c
};
/** CG8 (N2): nur `zoom-sdk` mit dem Detail `kein-jm-rechner`. */
const KEIN_JM_RECHNER_TEXT = '„Zoom-SDK laden“ gibt es nur auf JM-Rechnern. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“) oder bitte einen Admin, diesen Rechner als JM-Rechner zu markieren.';

/** Text zu einem Grund des Launchers (CG1–CG10); für `fehler` mit dem Detail (ohne Detail der Code selbst). */
export function grundText(zweck: ConnectZweck, g: FreigabeGrund, detail?: string | null): string {
  if (g === 'fehler') return `Freigabe fehlgeschlagen: ${detail || 'fehler'}`;
  if (g === 'kein-recht') return zweck === 'zoom-sdk' && detail === 'kein-jm-rechner' ? KEIN_JM_RECHNER_TEXT : KEIN_RECHT_TEXT[zweck];
  return GRUND_TEXT[g];
}

/** Text zu einem Grund der Zoom-Anmeldung: Gründe des Launchers über `zoom-jwt`, sonst ZA8–ZA10. */
export function jwtGrundText(g: JwtGrund, detail?: string | null): string {
  if (g === 'server-abgelehnt') return ZUGANG_TEXT.serverAbgelehnt;
  if (g === 'nicht-eingerichtet') return ZUGANG_TEXT.nichtEingerichtet;
  if (g === 'server-fehler') return ZUGANG_TEXT.serverFehler(detail || 'fehler');
  return grundText('zoom-jwt', g, detail);
}

/** Vorübergehende Gründe (Ton „warn“); alle übrigen brauchen einen Menschen (Ton „fehler“). */
const VORUEBERGEHEND: readonly JwtGrund[] = ['kein-launcher', 'niemand-angemeldet', 'abgelaufen', 'server-nicht-erreichbar', 'server-fehler'];
function grundTon(g: JwtGrund): Ton {
  return VORUEBERGEHEND.includes(g) ? 'warn' : 'fehler';
}

function stufeText(k: ConnectFreigabe['konto'] | null): string {
  return k ? STUFE_TEXT[k.stufe] : '';
}

/**
 * Zeile „Cloud-Zugang“ als Kreuzprodukt aus Wahl × Grund × abgelehnt × gelöscht × Umgebung.
 * Freigabe: CZ1 (ok), mit Grund und weniger als 24 h Rest CZ1 und der Grund (warn); alter Key: CZ2 (warn), mit Grund dahinter;
 * keiner: CZ3 (fehler) bei abgelehntem Key, sonst der Grund allein (Ton nach Regel), sonst CZ4 (ok). Danach CZ5 und CZ6.
 */
export function cloudZeile(l: ZugangsLage, jetzt: number): { text: string; ton: Ton } {
  let text: string;
  let ton: Ton;
  if (l.wahl === 'freigabe') {
    const bis = l.bis ?? jetzt;
    text = ZUGANG_TEXT.cloudFreigabe(l.konto?.name ?? '', stufeText(l.konto), datumText(bis), zeitText(bis));
    ton = 'ok';
    if (l.letzterGrund !== null && bis - jetzt < ERNEUERN_VOR_MS) {
      text = `${text} ${grundText('connect-raum', l.letzterGrund, l.detail)}`;
      ton = 'warn';
    }
  } else if (l.wahl === 'alter-key') {
    text = ZUGANG_TEXT.cloudAltKey;
    ton = 'warn';
    if (l.letzterGrund !== null) text = `${text} ${grundText('connect-raum', l.letzterGrund, l.detail)}`;
  } else if (l.altAbgelehnt) {
    text = ZUGANG_TEXT.cloudAltAbgelehnt;
    ton = 'fehler';
  } else if (l.letzterGrund !== null) {
    text = grundText('connect-raum', l.letzterGrund, l.detail);
    ton = grundTon(l.letzterGrund);
  } else {
    text = ZUGANG_TEXT.cloudNochNicht;
    ton = 'ok';
  }
  if (l.geloescht) text = `${text} ${ZUGANG_TEXT.cloudGeloescht}`;
  if (l.altHerkunft === 'env') text = `${text} ${ZUGANG_TEXT.cloudEnv}`;
  return { text, ton };
}

/**
 * Zeile „Zoom-Anmeldung“ als Kreuzprodukt aus Quelle × Grund × gelöscht × Entwicklung.
 * Server: ZA1 (ok); lokal: ZA2 (warn), mit Grund dahinter; keine: ZA3 mit dem Grund (Ton nach Regel), ohne Grund ZA4 (ok).
 * Danach ZA5, und nur bei Quelle `server` ZA11 (P6: bei `lokal` und `keine` nie).
 */
export function anmeldungZeile(l: ZoomAnmeldungLage, jetzt: number): { text: string; ton: Ton } {
  let text: string;
  let ton: Ton;
  if (l.quelle === 'server') {
    const bis = l.freigabeBis ?? jetzt;
    text = ZUGANG_TEXT.anmeldungServer(l.konto?.name ?? '', stufeText(l.konto), datumText(bis), zeitText(bis));
    ton = 'ok';
  } else if (l.quelle === 'lokal') {
    text = ZUGANG_TEXT.anmeldungLokal;
    ton = 'warn';
    if (l.grund !== null) text = `${text} ${jwtGrundText(l.grund, l.detail)}`;
  } else if (l.grund !== null) {
    text = ZUGANG_TEXT.anmeldungKeine(jwtGrundText(l.grund, l.detail));
    ton = grundTon(l.grund);
  } else {
    text = ZUGANG_TEXT.anmeldungNochNicht;
    ton = 'ok';
  }
  if (l.geloescht) text = `${text} ${ZUGANG_TEXT.zugangGeloescht}`;
  if (l.devTtlS !== null && l.quelle === 'server') text = `${text} ${ZUGANG_TEXT.entwicklungTtl(l.devTtlS)}`;
  return { text, ton };
}
