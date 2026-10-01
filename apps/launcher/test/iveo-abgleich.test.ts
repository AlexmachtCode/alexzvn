// iveo-Abgleich des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a, Spec 7 und 9.6: atomares Schreiben der Show (show-schreiben.ts) und der Abgleich-Kern
// (iveo-abgleich-kern.ts) mit nachgebautem iveo-Client — ohne Netz, ohne Fenster.
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { schreibeShowAtomar, warteSync, type DateiSystem } from '../src/main/show-schreiben';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// --- schreibeShow: Zwischendatei + Umbenennen, Wiederholung bei Sperre (Spec 7.4, 9.6 Nr. 11) -----------------
{
  const PFAD = 'C:/Shows/Tag1.jmshow';
  const gesperrt = (code: string): Error => Object.assign(new Error(`${code}: Datei gesperrt`), { code });
  /** Nachgebautes fs: Dateien im Speicher. `umbenennen` gibt je Versuch einen Fehlercode vor, null = gelingt. */
  function nachgebautesFs(umbenennen: Array<string | null>, anlegeFehler: string | null = null) {
    const dateien = new Map<string, string>([[PFAD, 'ALT']]);
    const aufrufe: string[] = [];
    let versuch = 0;
    const fs: DateiSystem = {
      writeFileSync(p, inhalt) {
        aufrufe.push(`schreibe ${p}`);
        if (anlegeFehler) throw gesperrt(anlegeFehler);
        dateien.set(p, inhalt);
      },
      renameSync(von, nach) {
        aufrufe.push(`benenne ${von}`);
        const f = umbenennen[versuch++] ?? null;
        if (f) throw gesperrt(f);
        dateien.set(nach, dateien.get(von)!);
        dateien.delete(von);
      },
      unlinkSync(p) {
        aufrufe.push(`loesche ${p}`);
        if (!dateien.delete(p)) throw gesperrt('ENOENT');
      },
    };
    return { fs, dateien, aufrufe, versuche: () => aufrufe.filter((a) => a.startsWith('benenne')).length };
  }
  const pausen: number[] = [];
  const warte = (ms: number): void => { pausen.push(ms); };
  const logZeilen: string[] = [];
  const log = (m: string): void => { logZeilen.push(m); };

  const zwei = nachgebautesFs(['EBUSY', 'EBUSY', null]);
  ck('Nr. 11: Umbenennen scheitert zweimal mit EBUSY → der dritte Versuch gelingt', schreibeShowAtomar(PFAD, 'NEU', zwei.fs, warte, log) === true);
  ck('Nr. 11: … drei Versuche, dazwischen zweimal 50 ms', zwei.versuche() === 3 && JSON.stringify(pausen) === '[50,50]');
  ck('Nr. 11: … die Show trägt den neuen Inhalt, keine Zwischendatei bleibt liegen', zwei.dateien.get(PFAD) === 'NEU' && zwei.dateien.size === 1);
  ck('Nr. 11: … kein Logeintrag', logZeilen.length === 0);
  const zwischen = zwei.aufrufe[0].slice('schreibe '.length);
  ck('Zwischendatei liegt im selben Ordner wie die Show und ist nicht die Show', dirname(zwischen) === dirname(PFAD) && zwischen !== PFAD);

  pausen.length = 0;
  const immer = nachgebautesFs(['EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY']);
  ck('Nr. 11: scheitert es immer → false', schreibeShowAtomar(PFAD, 'NEU', immer.fs, warte, log) === false);
  ck('Nr. 11: … genau 5 Versuche, 4 Pausen à 50 ms', immer.versuche() === 5 && JSON.stringify(pausen) === '[50,50,50,50]');
  ck('Nr. 11: … Zwischendatei gelöscht, Original unverändert',
    immer.aufrufe.includes(`loesche ${zwischen}`) && immer.dateien.get(PFAD) === 'ALT' && immer.dateien.size === 1);
  ck('Nr. 11: … eine Warnung mit dem Code, ohne Inhalt und ohne Pfad',
    logZeilen.length === 1 && logZeilen[0].includes('EBUSY') && !logZeilen[0].includes('NEU') && !logZeilen[0].includes(PFAD));

  pausen.length = 0;
  const andere = nachgebautesFs(['EPERM', 'EACCES', null]);
  ck('EPERM und EACCES gelten ebenso als vorübergehend',
    schreibeShowAtomar(PFAD, 'NEU', andere.fs, warte, log) === true && andere.dateien.get(PFAD) === 'NEU' && pausen.length === 2);

  pausen.length = 0;
  logZeilen.length = 0;
  const fremd = nachgebautesFs(['EXDEV']);
  ck('anderer Fehler beim Umbenennen (EXDEV) → sofort false, ohne Pause',
    schreibeShowAtomar(PFAD, 'NEU', fremd.fs, warte, log) === false && fremd.versuche() === 1 && pausen.length === 0);
  ck('… Zwischendatei gelöscht, Original unverändert, eine Warnung',
    fremd.aufrufe.includes(`loesche ${zwischen}`) && fremd.dateien.get(PFAD) === 'ALT' && fremd.dateien.size === 1 && logZeilen.length === 1);

  logZeilen.length = 0;
  const voll = nachgebautesFs([], 'ENOSPC');
  ck('Zwischendatei nicht anlegbar (ENOSPC) → false, kein Umbenennen, Original unverändert',
    schreibeShowAtomar(PFAD, 'NEU', voll.fs, warte, log) === false && voll.versuche() === 0
    && voll.dateien.get(PFAD) === 'ALT' && logZeilen.length === 1 && logZeilen[0].includes('ENOSPC'));

  // Echtes Dateisystem: ein Durchlauf in einem Temp-Ordner (so verdrahtet die Hülle es in der Produktion).
  const ordner = mkdtempSync(join(tmpdir(), 'jmiveo-'));
  try {
    const datei = join(ordner, 'Tag 1.jmshow');
    writeFileSync(datei, 'ALT', 'utf8');
    const ok = schreibeShowAtomar(datei, 'NEU', { writeFileSync, renameSync, unlinkSync }, warteSync, log);
    ck('echtes fs: geschrieben, im Ordner liegt nur die Show',
      ok && readFileSync(datei, 'utf8') === 'NEU' && JSON.stringify(readdirSync(ordner)) === JSON.stringify(['Tag 1.jmshow']));
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
  const t0 = Date.now();
  warteSync(30);
  ck('warteSync wartet synchron (30 ms)', Date.now() - t0 >= 25);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
