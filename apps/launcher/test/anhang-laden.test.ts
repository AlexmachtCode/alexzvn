// Gemeinsamer Ladeschritt von Ordner und Panel (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket P30 Fix-Runde 1: ladeAsset (Asset öffnen mit Leerlauf auch vor dem ersten Byte, in Datei laden, Bytezahl prüfen,
// Grund abbilden) und pruefeAssetGroesse (2-GiB-Grenze) sind EIN Baustein für die Ablage und den manuellen Download im Panel.
import path from 'node:path';
import { assetGroesse } from '../src/main/iveo-anhaenge';
import { GrundFehler, StromFehler, ladeAsset, pruefeAssetGroesse } from '../src/main/side-event-ordner-lauf';
import { ORDNER_GRUENDE } from '../src/main/side-event-ordner';
import { DownloadAttrappe, FsAttrappe, Gleichzeitig, TestUhr } from './ordner-attrappe';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const ZIEL = path.resolve('/attrappe/Ziel/datei.jm-laden');

async function lauf(art: Parameters<DownloadAttrappe['arten']['set']>[1], groesse: number | null, mehr: { signal?: AbortSignal; spule?: number } = {}) {
  const uhr = new TestUhr();
  const fs = new FsAttrappe('NTFS');
  await fs.mkdir(path.dirname(ZIEL), { recursive: true });
  const download = new DownloadAttrappe(new Gleichzeitig(), uhr);
  download.arten.set('ref', art);
  let geoeffnet = 0;
  const fortschritte: number[] = [];
  const p = ladeAsset({
    fs, client: download, ref: 'ref', ziel: ZIEL, groesse, leerlaufMs: 60_000, signal: mehr.signal,
    jetzt: uhr.jetzt, setTimeout: uhr.setTimeout, clearTimeout: uhr.clearTimeout,
    nachOeffnen: () => { geoeffnet++; }, fortschritt: (b) => { fortschritte.push(b); },
  }).then((bytes) => ({ bytes, fehler: null as unknown }), (fehler: unknown) => ({ bytes: -1, fehler }));
  if (mehr.spule) await uhr.spule(mehr.spule, 1000);
  const r = await p;
  return { ...r, fs, geoeffnet, fortschritte };
}

{
  const r = await lauf({ bytes: 1000, stuecke: 4 }, 1000);
  ck('Laden: Bytezahl = size_bytes → Bytes zurück, Datei liegt unter dem Ziel, nachOeffnen einmal, Fortschritt bis 1000',
    r.bytes === 1000 && r.fehler === null && r.fs.inhalt(ZIEL)?.length === 1000 && r.geoeffnet === 1 && r.fortschritte.at(-1) === 1000);
}
{
  const r = await lauf({ bytes: 1000 }, null);
  ck('Laden: ohne size_bytes gilt die Grenze 2 GiB, 1000 Bytes laden', r.bytes === 1000 && r.fehler === null);
}
{
  const r = await lauf({ bytes: 1000 }, 1100);
  ck('Laden: weniger Daten als size_bytes → GrundFehler „unvollständig“ (T22 f)',
    r.fehler instanceof GrundFehler && r.fehler.message === ORDNER_GRUENDE.unvollstaendig(1000, 1100));
}
{
  const r = await lauf({ bytes: 1000, stuecke: 2 }, 900);
  ck('Laden: mehr Daten als size_bytes → GrundFehler „mehr Daten“ (T22 b)',
    r.fehler instanceof GrundFehler && r.fehler.message === ORDNER_GRUENDE.mehrDaten(900));
}
{
  const r = await lauf({ oeffnenHaengt: true }, 1000, { spule: 61_000 });
  ck('Laden: keine Antwort binnen 60 s (vor dem ersten Byte) → StromFehler leerlauf, ohne Signal des Aufrufers',
    r.fehler instanceof StromFehler && r.fehler.grund === 'leerlauf' && r.geoeffnet === 0);
}
{
  const r = await lauf({ bytes: 1000, stuecke: 2, stillstandNach: 500 }, 1000, { spule: 61_000 });
  ck('Laden: Stillstand mitten im Datenstrom → StromFehler leerlauf', r.fehler instanceof StromFehler && r.fehler.grund === 'leerlauf' && r.geoeffnet === 1);
}
{
  const ac2 = new AbortController();
  const p = lauf({ oeffnenHaengt: true }, 1000, { signal: ac2.signal });
  setTimeout(() => ac2.abort(), 20);
  const r2 = await p;
  ck('Laden: Abbruch durch den Aufrufer (Bedienung) → StromFehler bedienung', r2.fehler instanceof StromFehler && r2.fehler.grund === 'bedienung');
}
{
  const r = await lauf({ fehler: new Error('kaputt') }, 1000);
  ck('Laden: Fehler von oeffneAsset gehen unverändert durch', r.fehler instanceof Error && r.fehler.message === 'kaputt');
}
{
  const GIB2 = 2 * 1024 ** 3;
  let g1: unknown = null, g2: unknown = null;
  try { pruefeAssetGroesse(GIB2 + 1); } catch (e) { g1 = e; }
  try { pruefeAssetGroesse(GIB2); pruefeAssetGroesse(null); } catch (e) { g2 = e; }
  ck('Größe: über 2 GiB → GrundFehler „zu groß“ (T22 a), genau 2 GiB und unbekannt erlaubt',
    g1 instanceof GrundFehler && g1.message === ORDNER_GRUENDE.zuGross(GIB2 + 1) && g2 === null);
}
ck('size_bytes-Regel: Zahl, endlich, ≥ 0 sonst null',
  assetGroesse(0) === 0 && assetGroesse(5) === 5 && assetGroesse(-1) === null && assetGroesse(NaN) === null && assetGroesse(Infinity) === null
  && assetGroesse('5') === null && assetGroesse(undefined) === null);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
