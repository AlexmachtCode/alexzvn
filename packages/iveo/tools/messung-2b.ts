// ─────────────────────────────────────────────────────────────────────────────
// Lese-Werkzeug für die Messaufgaben M1–M3 (Master-Link Teil 2b, Spec 23).
//
// Startet NUR der Owner in seiner eigenen PowerShell im Worktree, mit dem iveo-Token in der Umgebung. Das Token
// an der Eingabeaufforderung eingeben, dann steht es weder in der Befehlszeile noch im Verlauf:
//   $s = Read-Host 'iveo-Token' -AsSecureString
//   $env:JMPS_IVEO_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> <befehl> …
// Befehle:
//   ids [datei]                  Anzahl, Formen, Leerraum, Doppelte, ohne Kennung und Hashes der Speaker-Kennungen (M1 a, M3);
//                                mit [datei] legt es die Kennungen zusätzlich als JSON-Liste dort ab (für vergleiche)
//   vergleiche <datei1> <datei2> zwei mit ids abgelegte Listen: wie viele Kennungen nur in der ersten bzw. nur in der
//                                zweiten stehen (M1 a). Liest nur die beiden Dateien, ruft iveo nicht ab.
//   cache <pfad>                 Kennungen der iveo-Cache-Datei des Launchers gegen die API (M1 a)
//   speaker <name>               id, updated_at und title des Speakers mit genau diesem Anzeigenamen (M1 b)
//   programme-seit <iso> [id]    Programme mit updated_since; ist das Programm dabei? (M2 a)
//   speaker-seit <iso> [name]    /speakers mit updated_since, roh; Status, Anzahl, ist der Speaker dabei? (M2 b)
// Wie alle Befehle startet auch vergleiche nur mit gesetztem JMPS_IVEO_TOKEN; also vor dem Entfernen des Tokens aufrufen.
//
// Liest nur. Ausgegeben werden Zahlen, Hashes, Kennungen und HTTP-Status: nie das Token, keine Bio, keine Fotos,
// keine Namen außer dem gesuchten Test-Speaker und nie Antwortinhalte aus Fehlern. Die mit ids abgelegte Datei
// enthält nur Kennungen; sie bleibt beim Owner und wird nie eingecheckt.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs';
import { IveoApiError, createIveoClient, normalizeIveoBaseUrl, speakerName, type IveoSpeaker } from '../src/index';
import { kennungenAus, kennungsBericht, leseKennungsListe, vergleicheMengen, vergleicheMitCache } from './messung-2b-kern';

const NUTZUNG =
  'Aufruf: node node_modules/tsx/dist/cli.mjs packages/iveo/tools/messung-2b.ts --event <slug> --base <url> ' +
  '<ids [datei] | vergleiche <datei1> <datei2> | cache <pfad> | speaker <name> | programme-seit <iso> [programmId] | speaker-seit <iso> [name]>';

function abbruch(text: string, code: number): never {
  console.error(text);
  process.exit(code);
}

const token = (process.env.JMPS_IVEO_TOKEN ?? '').trim();
if (!token) abbruch('JMPS_IVEO_TOKEN fehlt (nur in der Owner-Konsole setzen).', 2);

// Optionen --event und --base, danach der Befehl und seine Argumente.
let event = '';
let base = '';
const rest: string[] = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--event') event = (argv[++i] ?? '').trim();
  else if (argv[i] === '--base') base = (argv[++i] ?? '').trim();
  else rest.push(argv[i]);
}
const [befehl, arg1, arg2] = rest;
if (!event || !base || !befehl) abbruch(NUTZUNG, 2);

const client = createIveoClient({ token, baseUrl: base });
const jaNein = (b: boolean): string => (b ? 'ja' : 'nein');

const echte = (liste: Array<string | null>): string[] => liste.filter((id): id is string => id !== null);

function zeitOderAbbruch(iso: string | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) abbruch(`Zeitpunkt nicht lesbar: ${iso ?? '(fehlt)'} (Beispiel 2026-10-02T08:00:00Z)`, 2);
  return iso;
}

async function ids(datei: string | undefined): Promise<void> {
  const liste = kennungenAus(await client.listSpeakers(event));
  const b = kennungsBericht(liste);
  console.log(`Anzahl: ${b.anzahl}`);
  console.log(`Formen: uuid ${b.formen.uuid}, ziffern ${b.formen.ziffern}, andere ${b.formen.andere}`);
  console.log(`Mit Leerraum: ${b.mitLeerraum}`);
  console.log(`Doppelte: ${b.doppelte}`);
  console.log(`Ohne Kennung: ${b.ohneKennung}`);
  console.log(`mengenHash: ${b.mengenHash}`);
  console.log(`reihenfolgeHash: ${b.reihenfolgeHash}`);
  if (datei) {
    // Nur die Kennungen, in API-Reihenfolge; keine Namen. Für den Vergleich zweier Abrufe (vergleiche).
    const abgelegt = echte(liste);
    writeFileSync(datei, JSON.stringify(abgelegt), 'utf8');
    console.log(`Kennungen abgelegt: ${abgelegt.length}`);
  }
}

/** Zwei mit `ids <datei>` abgelegte Listen vergleichen (M1 a). Liest nur die beiden Dateien, kein Netz. */
function vergleiche(datei1: string | undefined, datei2: string | undefined): void {
  if (!datei1 || !datei2) abbruch(NUTZUNG, 2);
  const lies = (pfad: string): string[] => {
    let text: string;
    try {
      text = readFileSync(pfad, 'utf8');
    } catch (e) {
      // Nie Dateiinhalt ausgeben, nur den Fehlercode.
      abbruch(`Kennungsdatei nicht lesbar: ${(e as { code?: string }).code ?? 'unbekannt'}`, 2);
    }
    const liste = leseKennungsListe(text);
    if (!liste) abbruch('Kennungsdatei ohne Kennungsliste (kein gültiges JSON oder keine Liste aus Texten).', 2);
    return liste;
  };
  const v = vergleicheMengen(lies(datei1), lies(datei2));
  console.log(`nurErste: ${v.nurErste}`);
  console.log(`nurZweite: ${v.nurZweite}`);
  console.log(`gleich: ${jaNein(v.gleich)}`);
}

async function cache(pfad: string | undefined): Promise<void> {
  if (!pfad) abbruch(NUTZUNG, 2);
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(pfad, 'utf8'));
  } catch (e) {
    // Nie Dateiinhalt ausgeben: bei kaputtem JSON nur „kein gültiges JSON“, sonst nur der Fehlercode.
    const grund = e instanceof SyntaxError ? 'kein gültiges JSON' : ((e as { code?: string }).code ?? 'unbekannt');
    abbruch(`Cache-Datei nicht lesbar: ${grund}`, 2);
  }
  const liste = (roh as { speakers?: unknown } | null)?.speakers;
  if (!Array.isArray(liste)) abbruch('Cache-Datei ohne Speaker-Liste (speakers[]).', 2);
  const api = kennungenAus(await client.listSpeakers(event));
  const imCache = kennungenAus(liste);
  const v = vergleicheMitCache(echte(api), echte(imCache));
  console.log(`nurApi: ${v.nurApi}`);
  console.log(`nurCache: ${v.nurCache}`);
  console.log(`gleich: ${jaNein(v.gleich)}`);
  console.log(`Ohne Kennung: API ${api.length - echte(api).length}, Cache ${imCache.length - echte(imCache).length}`);
}

async function speaker(name: string | undefined): Promise<void> {
  if (!name) abbruch(NUTZUNG, 2);
  const treffer = (await client.listSpeakers(event)).filter((s) => speakerName(s) === name);
  console.log(`Treffer: ${treffer.length}`);
  for (const s of treffer) {
    console.log(`id: ${s.id}`);
    console.log(`updated_at: ${s.updated_at ?? '(fehlt)'}`);
    console.log(`title: ${s.title ?? '(leer)'}`);
  }
}

async function programmeSeit(iso: string | undefined, programmId: string | undefined): Promise<void> {
  const seit = zeitOderAbbruch(iso);
  const programme = await client.listProgramsUpdatedSince(event, seit);
  console.log(`Anzahl: ${programme.length}`);
  if (programmId) console.log(`Programm ${programmId} dabei: ${jaNein(programme.some((p) => p.id === programmId))}`);
}

/** Roher Abruf, weil der Client /speakers nicht mit updated_since kennt (M2 b). Folgt dem Cursor über alle Seiten. */
async function speakerSeit(iso: string | undefined, name: string | undefined): Promise<void> {
  const seit = zeitOderAbbruch(iso);
  const url =
    `${normalizeIveoBaseUrl(base)}/events/${encodeURIComponent(event)}/speakers` +
    `?limit=200&updated_since=${encodeURIComponent(seit)}`;
  const kopf = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const alle: IveoSpeaker[] = [];
  let cursor: string | null = null;
  for (let seite = 0; seite < 50; seite++) {
    const res = await fetch(cursor ? `${url}&cursor=${encodeURIComponent(cursor)}` : url, { headers: kopf });
    if (seite === 0 || !res.ok) console.log(`HTTP-Status${seite ? ` (Seite ${seite + 1})` : ''}: ${res.status}`);
    if (!res.ok) {
      const fehler = (await res.json().catch(() => null)) as { errors?: Array<{ code?: string }> } | null;
      console.log(`Fehlercode: ${fehler?.errors?.[0]?.code ?? '(keiner)'}`);
      return;
    }
    const antwort = (await res.json()) as { data?: IveoSpeaker[]; meta?: { pagination?: { next_cursor?: string | null } } };
    if (Array.isArray(antwort.data)) alle.push(...antwort.data);
    cursor = antwort.meta?.pagination?.next_cursor ?? null;
    if (!cursor) break;
  }
  if (cursor) console.log('Abgebrochen nach 50 Seiten: Anzahl unvollständig');
  console.log(`Anzahl: ${alle.length}`);
  if (name) console.log(`${name} dabei: ${jaNein(alle.some((s) => speakerName(s) === name))}`);
}

try {
  switch (befehl) {
    case 'ids':
      await ids(arg1);
      break;
    case 'vergleiche':
      vergleiche(arg1, arg2);
      break;
    case 'cache':
      await cache(arg1);
      break;
    case 'speaker':
      await speaker(arg1);
      break;
    case 'programme-seit':
      await programmeSeit(arg1, arg2);
      break;
    case 'speaker-seit':
      await speakerSeit(arg1, arg2);
      break;
    default:
      abbruch(NUTZUNG, 2);
  }
} catch (e) {
  // Nie Antwortinhalte: IveoApiError nur mit Status und Code, kaputtes JSON nur als „kein gültiges JSON“.
  const grund =
    e instanceof IveoApiError
      ? `HTTP ${e.status} ${e.code}`
      : e instanceof SyntaxError
        ? 'kein gültiges JSON'
        : (e as Error)?.message || String(e);
  abbruch(`Abbruch: ${grund}`, 1);
}
