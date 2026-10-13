// ─────────────────────────────────────────────────────────────────────────────
// Titler: Show-Quelle auf der Platte (Master-Link Teil 2b, Spec 7.6 und 7.7).
//
// • Gemerkte Show `<userData>/show-zuletzt.json` = { showPfad, showName, mitSpeakern }.
//   Sie übersteht einen Neustart, damit RELOAD auch nach einem Start über die Kachel
//   wirkt. Geschrieben wird atomar: erst `show-zuletzt.json.tmp`, dann umbenennen (G6).
//   Gelesen wird tolerant: fehlt die Datei, ist sie kaputt oder stimmt ein Feld nicht,
//   gilt „keine gemerkte Show“.
// • Show sicher lesen: wirft nie. Der Grund nennt nie Dateiinhalt (G10): bei kaputtem
//   JSON nur „kein gültiges JSON“, sonst nur den Fehlercode (ENOENT, EBUSY …).
//
// Ohne Electron: der Titler-Selbsttest (tsx) lädt das Modul direkt. `userData` gibt
// der Aufrufer (`app.getPath('userData')`) hinein.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseShow, type Show } from '@jm/show';
import { istMasterForm, type GemerkteShow } from '../shared/datenquelle';

/** Dateiname der gemerkten Show im userData-Ordner (G6). */
export const GEMERKT_DATEI = 'show-zuletzt.json';

/** Nur ein Fehlercode wie ENOENT oder EBUSY, nie ein Fehlertext (der kann Inhalt tragen). */
const FEHLERCODE = /^[A-Z][A-Z0-9_]*$/;

/** Schlüssel einer Show am Master (Spec 13.2): genau 16 Zeichen [0-9a-f]. */
const MASTER_SCHLUESSEL = /^[0-9a-f]{16}$/;

/**
 * Gemerkte Show lesen. `null`, wenn die Datei fehlt, kein gültiges JSON ist oder ein Feld nicht stimmt.
 * Zwei Formen (Spec 17.2): `{ quelle: 'master', masterId, schluessel, showName }` im Verbundmodus,
 * sonst `{ showPfad, showName, mitSpeakern }`. Eine Datei mit `quelle: 'master'` gilt nie als Pfad-Form.
 */
export function leseGemerkteShow(userData: string): GemerkteShow | null {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(join(userData, GEMERKT_DATEI), 'utf8'));
  } catch {
    return null;
  }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const o = roh as Record<string, unknown>;
  if (o.quelle === 'master') {
    if (typeof o.masterId !== 'string' || !o.masterId.trim()) return null;
    if (o.schluessel !== null && (typeof o.schluessel !== 'string' || !MASTER_SCHLUESSEL.test(o.schluessel))) return null;
    if (typeof o.showName !== 'string') return null;
    return { quelle: 'master', masterId: o.masterId, schluessel: o.schluessel, showName: o.showName };
  }
  if (typeof o.showPfad !== 'string' || !o.showPfad.trim()) return null;
  if (typeof o.showName !== 'string') return null;
  if (typeof o.mitSpeakern !== 'boolean') return null;
  return { showPfad: o.showPfad, showName: o.showName, mitSpeakern: o.mitSpeakern };
}

/** Gemerkte Show atomar schreiben (Zwischendatei, dann umbenennen). `false`, wenn das nicht gelang. */
export function schreibeGemerkteShow(userData: string, wert: GemerkteShow): boolean {
  const ziel = join(userData, GEMERKT_DATEI);
  const zwischen = `${ziel}.tmp`;
  try {
    mkdirSync(userData, { recursive: true });
    const inhalt = istMasterForm(wert)
      ? { quelle: 'master', masterId: wert.masterId, schluessel: wert.schluessel, showName: wert.showName }
      : { showPfad: wert.showPfad, showName: wert.showName, mitSpeakern: wert.mitSpeakern };
    writeFileSync(zwischen, JSON.stringify(inhalt, null, 2) + '\n', 'utf8');
    renameSync(zwischen, ziel);
    return true;
  } catch {
    try {
      rmSync(zwischen, { force: true });
    } catch {
      /* Zwischendatei ließ sich nicht löschen — egal, das nächste Schreiben überschreibt sie */
    }
    return false;
  }
}

/** Gemerkte Show löschen (Ordnerwahl oder Knopf „Zurück zum eigenen Ordner“). Wirft nie. */
export function loescheGemerkteShow(userData: string): void {
  try {
    rmSync(join(userData, GEMERKT_DATEI), { force: true });
  } catch {
    /* nicht löschbar (z. B. ein Ordner gleichen Namens) — das Lesen verwirft sie ohnehin */
  }
}

/**
 * Show lesen, ohne zu werfen (Spec 7.6, Review Focus 4). Halb geschriebenes JSON →
 * `{ grund: 'kein gültiges JSON' }`, gesperrte oder fehlende Datei → `{ grund: <Fehlercode> }`,
 * sonst `{ grund: 'nicht lesbar' }`. Der Grund enthält nie Dateiinhalt (G10).
 * `lese` ist für Tests austauschbar.
 */
export function leseShowSicher(
  pfad: string,
  lese: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): { show: Show } | { grund: string } {
  try {
    return { show: parseShow(lese(pfad)) };
  } catch (err) {
    if (err instanceof SyntaxError) return { grund: 'kein gültiges JSON' };
    const code = (err as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && FEHLERCODE.test(code)) return { grund: code };
    return { grund: 'nicht lesbar' };
  }
}
