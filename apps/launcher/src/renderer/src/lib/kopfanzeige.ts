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

/**
 * Derselbe Kopf, aber mit dem Master-Namen (Fremdtext) als eigenem Teil: `vor + name + nach` ist der Text von `Kopf`.
 * Bei 980 px ist der Platz im Kopf knapp; die Anzeige darf NUR den Namen kürzen (eigenes truncate), nie den Statusteil,
 * den Code oder „· Karte fehlt“ — sie unterscheiden die Zustände der Tabelle 5.4. Ohne Namen steht alles in `vor`.
 */
export interface KopfZeile {
  vor: string;
  name: string;
  nach: string;
  farbe: Farbe;
}

type Teile = Pick<KopfZeile, 'vor' | 'name' | 'nach'>;
const fest = (text: string): Teile => ({ vor: text, name: '', nach: '' });
const mitName = (vor: string, name: string, nach: string): Teile => ({ vor, name, nach });

// Fremdtexte (Master-Name, I/O- und Fehlercodes) stehen dauerhaft im Kopf und kommen nie ungekürzt hinein.
// Die Kürzung an der Quelle (Master-Link, Namen ≤ 60) bleibt zusätzlich deren Sache.
const MAX_NAME = 60;
const MAX_CODE = 32;

/** Auf `max` ganze Zeichen (Codepoints, nicht UTF-16-Einheiten) kürzen: ein Emoji wird nie zerschnitten. */
function kuerze(text: string, max: number): string {
  const zeichen = Array.from(text);
  return zeichen.length <= max ? text : zeichen.slice(0, max).join('');
}

function fehlerKopf(code: VerbundFehlerCode, name: string, errCode?: string): Teile {
  switch (code) {
    case 'zeit': return mitName('', name, ' sichtbar, Port gesperrt: Firewall?');
    case 'nicht-gefunden': return mitName('', name, ' nicht erreichbar');
    case 'verweigert': return mitName('', name, ': Master-Modus aus?');
    case 'netz': return mitName('', name, ': Netz nicht erreichbar');
    case 'kein-master': return fest('Adresse antwortet nicht als Master');
    case 'zertifikat': return fest('Anderer Master unter dieser Adresse');
    case 'uhr': return fest('Uhrzeit prüfen');
    case 'protokoll': return fest('Versionen angleichen');
    case 'unbekannt': return fest('Vom Master entfernt: neu koppeln');
    case 'signatur': return fest('Anmeldung abgelehnt: neu koppeln');
    case 'ersetzt': return fest('Kennung doppelt: neu koppeln');
    case 'datei': return fest('Kopplung beschädigt: neu koppeln');
    case 'sonstig': return fest(`Verbindungsfehler ${errCode ?? 'unbekannt'}`);
  }
}

function grund(e: KopfEingang): KopfZeile {
  if (e.rolle === 'aus') return { ...fest('Verbund aus'), farbe: 'gedaempft' };
  if (e.rolle === 'gesperrt') return { ...fest(`Kopplungsdatei gesperrt: ${e.errCode}`), farbe: 'rot' };
  if (e.rolle === 'master') {
    if (e.zustand === 'laeuft') {
      if (e.m === 0) return { ...fest('Master · noch keine Rechner'), farbe: 'neutral' };
      return { ...fest(`Master · ${e.n}/${e.m} Rechner online`), farbe: e.n === e.m ? 'gruen' : 'gelb' };
    }
    if (e.zustand === 'lausch-fehler') return { ...fest(`Master-Fehler: ${e.errCode}`), farbe: 'rot' };
    if (e.zustand === 'startet') return { ...fest('Master startet…'), farbe: 'gedaempft' };
    if (e.zustand === 'port-belegt') return { ...fest('Master: Port 8738 belegt'), farbe: 'rot' };
    if (e.zustand === 'daten-beschaedigt') return { ...fest('Master: Verbunddaten beschädigt'), farbe: 'rot' };
    const fehlt: never = e.zustand; // Spec 5.4: Vollständigkeitsprüfung — ein neuer MasterZustand bricht tsc
    return fehlt;
  }
  // Rolle slave — der switch ist erschöpfend (tsc prüft das über den Rückgabetyp).
  switch (e.zustand) {
    case 'nicht-gekoppelt': return { ...fest('Nicht gekoppelt: Master wählen'), farbe: 'gedaempft' };
    case 'koppelt': return { ...mitName('Koppeln mit ', e.name, '…'), farbe: 'gelb' };
    case 'sucht': return { ...mitName('Suche ', e.name, '…'), farbe: 'gelb' };
    case 'verbindet': return { ...mitName('Verbinde mit ', e.name, '…'), farbe: 'gelb' };
    case 'verbunden': return { ...mitName('', e.name, ' ●'), farbe: 'gruen' };
    case 'fehler': return { ...fehlerKopf(e.code, e.name, e.errCode), farbe: 'rot' };
  }
}

/** Spec 5.4 „Karte fehlt“: grün/neutral → gelb + Hinweis; gelb/gedämpft → Hinweis; rot → unverändert. */
export function kopfZeile(e: KopfEingang): KopfZeile {
  const k = grund(e);
  if (e.rolle === 'aus' || e.rolle === 'gesperrt' || !e.karteFehlt || k.farbe === 'rot') return k;
  const farbe: Farbe = k.farbe === 'gruen' || k.farbe === 'neutral' ? 'gelb' : k.farbe;
  const hinweis = ' · Karte fehlt';
  // Ohne Namen steht alles in `vor`; mit Namen hängt der Hinweis hinter den Namen.
  return k.name === '' ? { ...k, vor: k.vor + hinweis, farbe } : { ...k, nach: k.nach + hinweis, farbe };
}

/** Der volle Text der Kopfanzeige (Tooltip, Modal, Tests): `kopfZeile()` ohne die Trennung des Namens. */
export function kopfanzeige(e: KopfEingang): Kopf {
  const z = kopfZeile(e);
  return { text: z.vor + z.name + z.nach, farbe: z.farbe };
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
