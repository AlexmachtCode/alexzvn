import type { VerbundFehlerCode, VerbundStand } from '@shared/types';

// Kopfanzeige des Verbunds (Spec 5.4) als REINE Funktion — getestet gegen jede Tabellenzeile.
// Nur `import type`: test/selftest.ts laedt diese Datei per strip-types ohne Alias.

export type Farbe = 'gedaempft' | 'neutral' | 'gruen' | 'gelb' | 'rot';

export type KopfEingang =
  | { rolle: 'aus' }
  // Nicht in Tabelle 5.4: master-link.json beim Start nicht lesbar (Spec 7.3) — Rolle unbekannt.
  | { rolle: 'gesperrt'; errCode: string }
  | { rolle: 'master'; zustand: 'startet' | 'port-belegt' | 'daten-beschaedigt'; karteFehlt: boolean }
  | { rolle: 'master'; zustand: 'lausch-fehler'; errCode: string; karteFehlt: boolean }
  | { rolle: 'master'; zustand: 'laeuft'; n: number; m: number; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'nicht-gekoppelt'; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'koppelt' | 'sucht' | 'verbindet' | 'verbunden'; name: string; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'fehler'; code: VerbundFehlerCode; name: string; errCode?: string; karteFehlt: boolean };

export interface Kopf {
  text: string;
  farbe: Farbe;
}

// Fremdtexte (Master-Name, I/O- und Fehlercodes) stehen dauerhaft im Kopf und kommen nie ungekürzt hinein.
// Die Kürzung an der Quelle (Master-Link, Namen ≤ 60) bleibt zusätzlich deren Sache.
const MAX_NAME = 60;
const MAX_CODE = 32;

/** Auf `max` ganze Zeichen (Codepoints, nicht UTF-16-Einheiten) kürzen: ein Emoji wird nie zerschnitten. */
function kuerze(text: string, max: number): string {
  const zeichen = Array.from(text);
  return zeichen.length <= max ? text : zeichen.slice(0, max).join('');
}

function fehlerKopf(code: VerbundFehlerCode, name: string, errCode?: string): string {
  switch (code) {
    case 'zeit': return `${name} sichtbar, Port gesperrt: Firewall?`;
    case 'nicht-gefunden': return `${name} nicht erreichbar`;
    case 'verweigert': return `${name}: Master-Modus aus?`;
    case 'netz': return `${name}: Netz nicht erreichbar`;
    case 'kein-master': return 'Adresse antwortet nicht als Master';
    case 'zertifikat': return 'Anderer Master unter dieser Adresse';
    case 'uhr': return 'Uhrzeit prüfen';
    case 'protokoll': return 'Versionen angleichen';
    case 'unbekannt': return 'Vom Master entfernt: neu koppeln';
    case 'signatur': return 'Anmeldung abgelehnt: neu koppeln';
    case 'ersetzt': return 'Kennung doppelt: neu koppeln';
    case 'datei': return 'Kopplung beschädigt: neu koppeln';
    case 'sonstig': return `Verbindungsfehler ${errCode ?? 'unbekannt'}`;
  }
}

function grund(e: KopfEingang): Kopf {
  if (e.rolle === 'aus') return { text: 'Verbund aus', farbe: 'gedaempft' };
  if (e.rolle === 'gesperrt') return { text: `Kopplungsdatei gesperrt: ${e.errCode}`, farbe: 'rot' };
  if (e.rolle === 'master') {
    if (e.zustand === 'laeuft') {
      if (e.m === 0) return { text: 'Master · noch keine Rechner', farbe: 'neutral' };
      return { text: `Master · ${e.n}/${e.m} Rechner online`, farbe: e.n === e.m ? 'gruen' : 'gelb' };
    }
    if (e.zustand === 'lausch-fehler') return { text: `Master-Fehler: ${e.errCode}`, farbe: 'rot' };
    if (e.zustand === 'startet') return { text: 'Master startet…', farbe: 'gedaempft' };
    if (e.zustand === 'port-belegt') return { text: 'Master: Port 8738 belegt', farbe: 'rot' };
    if (e.zustand === 'daten-beschaedigt') return { text: 'Master: Verbunddaten beschädigt', farbe: 'rot' };
    const fehlt: never = e.zustand; // Spec 5.4: Vollständigkeitsprüfung — ein neuer MasterZustand bricht tsc
    return fehlt;
  }
  // Rolle slave — der switch ist erschöpfend (tsc prüft das über den Rückgabetyp).
  switch (e.zustand) {
    case 'nicht-gekoppelt': return { text: 'Nicht gekoppelt: Master wählen', farbe: 'gedaempft' };
    case 'koppelt': return { text: `Koppeln mit ${e.name}…`, farbe: 'gelb' };
    case 'sucht': return { text: `Suche ${e.name}…`, farbe: 'gelb' };
    case 'verbindet': return { text: `Verbinde mit ${e.name}…`, farbe: 'gelb' };
    case 'verbunden': return { text: `${e.name} ●`, farbe: 'gruen' };
    case 'fehler': return { text: fehlerKopf(e.code, e.name, e.errCode), farbe: 'rot' };
  }
}

/** Spec 5.4 „Karte fehlt“: grün/neutral → gelb + Hinweis; gelb/gedämpft → Hinweis; rot → unverändert. */
export function kopfanzeige(e: KopfEingang): Kopf {
  const k = grund(e);
  if (e.rolle === 'aus' || e.rolle === 'gesperrt' || !e.karteFehlt || k.farbe === 'rot') return k;
  const farbe: Farbe = k.farbe === 'gruen' || k.farbe === 'neutral' ? 'gelb' : k.farbe;
  return { text: `${k.text} · Karte fehlt`, farbe };
}

export function kopfEingang(s: VerbundStand): KopfEingang {
  // Weder „Verbund aus“ (die Rolle ist unbekannt) noch „neu koppeln“ (das überschriebe eine intakte Kopplung).
  if (s.dateiFehler) return { rolle: 'gesperrt', errCode: kuerze(s.dateiFehler, MAX_CODE) };
  const karteFehlt = s.karteFehlt;
  if (s.rolle === 'aus') return { rolle: 'aus' };
  if (s.rolle === 'master') {
    const m = s.master;
    if (!m) return { rolle: 'master', zustand: 'startet', karteFehlt };
    if (m.zustand === 'laeuft') {
      const fremde = m.rechner.filter((r) => !r.dieserRechner);
      return { rolle: 'master', zustand: 'laeuft', n: fremde.filter((r) => r.online).length, m: fremde.length, karteFehlt };
    }
    if (m.zustand === 'lausch-fehler') return { rolle: 'master', zustand: 'lausch-fehler', errCode: kuerze(m.fehlerCode ?? '?', MAX_CODE), karteFehlt };
    return { rolle: 'master', zustand: m.zustand, karteFehlt };
  }
  const sl = s.slave;
  const name = kuerze(sl?.masterName ?? 'Master', MAX_NAME);
  if (sl?.koppeltGerade) return { rolle: 'slave', zustand: 'koppelt', name, karteFehlt };
  // master-link.json beim Start beschädigt: der Launcher hält keine Kopplung, sein Client meldet `datei` →
  // rot „Kopplung beschädigt: neu koppeln“ statt gedämpft „Nicht gekoppelt“ (Spec 5.4, 7.3).
  if (sl?.client.art === 'fehler' && sl.client.code === 'datei') {
    return { rolle: 'slave', zustand: 'fehler', code: 'datei', name, karteFehlt };
  }
  if (!sl || !sl.gekoppelt) return { rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt };
  const c = sl.client;
  if (c.art === 'fehler') {
    // `code` ist im Typ optional: ein Fehler ohne code bleibt rot (sonstig), er fällt nie auf „Suche …“ in gelb durch (#208).
    const errCode = c.errCode === undefined ? undefined : kuerze(c.errCode, MAX_CODE);
    return { rolle: 'slave', zustand: 'fehler', code: c.code ?? 'sonstig', name, errCode, karteFehlt };
  }
  if (c.art === 'verbunden' || c.art === 'verbindet') return { rolle: 'slave', zustand: c.art, name, karteFehlt };
  return { rolle: 'slave', zustand: 'sucht', name, karteFehlt };
}
