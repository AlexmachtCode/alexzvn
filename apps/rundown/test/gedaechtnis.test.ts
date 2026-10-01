// Selbsttest der Gedächtnis-Dateiebene (Spec 4.7, 4.8, 5.2) auf einem Temp-Ordner, ohne Electron:
//   node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts
// Der Hook (test/register.mjs → test/resolve-ts.mjs) ergänzt die `.ts`-Endung der relativen
// Importe in src/main/gedaechtnis.ts, wie es im Build electron-vite tut.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dateiStand,
  gedaechtnisSchluessel,
  leseGedaechtnis,
  legeGedaechtnisFehlerBei,
  leseShowSicher,
  leseZeiger,
  loescheZeiger,
  rundownDateiDerShow,
  schreibeGedaechtnis,
  schreibeZeiger,
  sichereAltenAutosave,
  sichereDefektesGedaechtnis,
} from '../src/main/gedaechtnis.ts';
import type { GedaechtnisInhalt } from '../src/shared/ausgangsstand.ts';

let failed = 0;
/** Schlüssel rekursiv sortieren: der Vergleich hängt nicht an der Feldreihenfolge der Normalisierer. */
function sortiert(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortiert);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortiert(o[k])]));
  }
  return v;
}
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(sortiert(actual));
  const e = JSON.stringify(sortiert(expected));
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'jm-rundown-gedaechtnis-'));
const ordner = join(tmp, 'regie');
try {
  // ── gedaechtnisSchluessel (4.7) ────────────────────────────────────────────
  const showPfad = join(tmp, 'Shows', 'Tag 1.jmshow');
  const s1 = gedaechtnisSchluessel(showPfad);
  eq(/^[0-9a-f]{16}$/.test(s1), true, 'Schlüssel: 16 Hex-Zeichen');
  eq(gedaechtnisSchluessel(join(tmp, 'shows', 'x', '..', 'TAG 1.jmshow')), s1, 'Schlüssel: Pfad aufgelöst und kleingeschrieben');
  eq(gedaechtnisSchluessel(join(tmp, 'Shows', 'Tag 2.jmshow')) === s1, false, 'Schlüssel: andere Show-Datei → anderer Schlüssel');

  // ── Gedächtnis schreiben und lesen ─────────────────────────────────────────
  eq(leseGedaechtnis(ordner, s1), { inhalt: null }, 'kein Gedächtnis → inhalt null, kein Fehler');
  const inhalt: GedaechtnisInhalt = {
    schemaVersion: 2,
    showPfad,
    showName: 'Tag 1',
    doc: {
      schemaVersion: 2,
      name: 'Tag 1',
      kontext: 'se:p1',
      rows: [
        {
          id: 'u1',
          label: 'Begrüßung',
          quelle: 'ablauf',
          actions: [{ id: 'a1', role: 'timer', verb: 'goto', args: [2], enabled: true, zielId: 'u2' }],
        },
        {
          id: 'u2',
          label: 'Panel',
          quelle: 'ablauf',
          entfallen: true,
          actions: [{ id: 'a2', role: 'titler', verb: 'take', args: [], enabled: false }],
        },
        { id: 'r_eigen', label: 'Einspieler', actions: [] },
      ],
      archiv: { 'se:p2': [{ id: 'v1', label: 'Andere Agenda', quelle: 'ablauf', actions: [] }] },
    },
    scharfId: 'u1',
    gespeichertAm: '2026-10-01T10:00:00.000Z',
  };
  eq(schreibeGedaechtnis(ordner, inhalt), true, 'schreibeGedaechtnis → true (Ordner wird angelegt)');
  eq(readdirSync(ordner), [`${s1}.json`], 'Datei heißt <schlüssel>.json, keine Zwischendatei übrig');
  eq(leseGedaechtnis(ordner, s1), { inhalt }, 'Gedächtnis kommt unverändert zurück (Archiv, Markierung, zielId, scharfId)');
  const mitDatei: GedaechtnisInhalt = {
    ...inhalt,
    datei: { pfad: join(tmp, 'eigen.jmrundown'), mtimeMs: 1727776800000, groesse: 42, sha256: 'a'.repeat(64) },
  };
  schreibeGedaechtnis(ordner, mitDatei);
  eq(leseGedaechtnis(ordner, s1).inhalt?.datei, mitDatei.datei, 'datei-Stand (4.8) bleibt erhalten');

  // ── Review-Focus 2: kaputtes Gedächtnis ────────────────────────────────────
  const gPfad = join(ordner, `${s1}.json`);
  const halbGeschrieben = '{"schemaVersion":2,"showPfad":"GEHEIM","doc":{"rows":[';
  writeFileSync(gPfad, halbGeschrieben);
  eq(leseGedaechtnis(ordner, s1), { inhalt: null, fehler: 'kein-json' }, 'kaputtes JSON → inhalt null, fehler kein-json');
  eq(readFileSync(gPfad, 'utf8'), halbGeschrieben, 'kaputte Datei bleibt liegen (nicht gelöscht)');
  const beiseite = sichereDefektesGedaechtnis(ordner, s1);
  eq(beiseite, join(ordner, `${s1}.defekt.json`), 'defektes Gedächtnis → <schlüssel>.defekt.json');
  eq(beiseite ? readFileSync(beiseite, 'utf8') : null, halbGeschrieben, 'Sicherung enthält den defekten Stand');
  writeFileSync(gPfad, JSON.stringify({ schemaVersion: 1, showPfad: 'x', doc: {} }));
  eq(leseGedaechtnis(ordner, s1), { inhalt: null, fehler: 'unlesbar' }, 'falsche Form → fehler unlesbar');
  eq(schreibeGedaechtnis(ordner, inhalt), true, 'nach dem Defekt: Schreiben gelingt');
  eq(leseGedaechtnis(ordner, s1).inhalt?.scharfId, 'u1', 'nach dem Defekt: Gedächtnis wieder lesbar');

  // ── Fix-Runde 1: I/O-Fehler ist kein Inhaltsfehler ─────────────────────────
  const ioSchluessel = '0123456789abcdef';
  mkdirSync(join(ordner, `${ioSchluessel}.json`));
  eq(leseGedaechtnis(ordner, ioSchluessel), { inhalt: null, fehler: 'io' }, 'Lesefehler außer ENOENT (hier EISDIR) → fehler io');
  eq(legeGedaechtnisFehlerBei(ordner, ioSchluessel, 'io'), 'gesperrt', 'io → Sperre, nichts wird beiseitegelegt');
  eq(readdirSync(ordner).includes(`${ioSchluessel}.defekt.json`), false, 'io: keine .defekt.json angelegt');
  writeFileSync(gPfad, halbGeschrieben);
  eq(legeGedaechtnisFehlerBei(ordner, s1, 'kein-json'), 'beiseite', 'kaputter Inhalt, Kopie gelingt → beiseite');
  eq(legeGedaechtnisFehlerBei(ordner, s1, 'unlesbar'), 'beiseite', 'falsche Form, Kopie gelingt → beiseite');
  rmSync(gPfad);
  eq(legeGedaechtnisFehlerBei(ordner, s1, 'kein-json'), 'gesperrt', 'Kopie scheitert → Sperre statt "beschädigt"');
  schreibeGedaechtnis(ordner, inhalt);

  // ── atomar: Umbenennen scheitert ───────────────────────────────────────────
  const zweiterPfad = join(tmp, 'Shows', 'Tag 2.jmshow');
  mkdirSync(join(ordner, `${gedaechtnisSchluessel(zweiterPfad)}.json`));
  eq(schreibeGedaechtnis(ordner, { ...inhalt, showPfad: zweiterPfad }), false, 'Ziel ist ein Ordner → false');
  eq(readdirSync(ordner).filter((n) => n.endsWith('.tmp')), [], 'gescheitertes Schreiben räumt die Zwischendatei weg');

  // ── Zeiger regie/zuletzt.json (4.7) ────────────────────────────────────────
  eq(leseZeiger(ordner), null, 'kein Zeiger → null');
  eq(schreibeZeiger(ordner, { showPfad, schluessel: s1 }), true, 'Zeiger geschrieben');
  eq(leseZeiger(ordner), { showPfad, schluessel: s1 }, 'Zeiger gelesen');
  writeFileSync(join(ordner, 'zuletzt.json'), JSON.stringify({ showPfad, schluessel: '../../boese' }));
  eq(leseZeiger(ordner), null, 'Zeiger mit ungültigem Schlüssel → null');
  writeFileSync(join(ordner, 'zuletzt.json'), '{"showPfad":');
  eq(leseZeiger(ordner), null, 'kaputter Zeiger → null');
  loescheZeiger(ordner);
  eq(readdirSync(ordner).includes('zuletzt.json'), false, 'Zeiger gelöscht');
  loescheZeiger(ordner);
  eq(true, true, 'Zeiger zweimal löschen wirft nicht');

  // ── alter Autosave (5.2, Übergangsregel) ───────────────────────────────────
  const userData = join(tmp, 'userData');
  mkdirSync(userData);
  eq(sichereAltenAutosave(userData), false, 'ohne Autosave → false');
  const altText = JSON.stringify({ schemaVersion: 1, name: 'COP31', rows: [] });
  writeFileSync(join(userData, 'rundown.autosave.jmrundown'), altText);
  eq(sichereAltenAutosave(userData), true, 'alter Autosave gesichert → true');
  eq(readFileSync(join(userData, 'rundown.autosave.v1.jmrundown'), 'utf8'), altText, 'Sicherung = alter Autosave');
  writeFileSync(join(userData, 'rundown.autosave.jmrundown'), '{"schemaVersion":2,"name":"neu","rows":[]}');
  eq(sichereAltenAutosave(userData), true, 'Sicherung liegt schon vor → true');
  eq(readFileSync(join(userData, 'rundown.autosave.v1.jmrundown'), 'utf8'), altText, 'vorhandene Sicherung wird nicht überschrieben');

  // ── Review-Focus 1: Show lesen ─────────────────────────────────────────────
  mkdirSync(join(tmp, 'Shows'), { recursive: true });
  eq(leseShowSicher(showPfad), { ok: false, grund: 'Datei nicht gefunden' }, 'fehlende Show → nicht lesbar');
  writeFileSync(showPfad, '{"schemaVersion":1,"name":"Geheimname","tools":[');
  const halb = leseShowSicher(showPfad);
  eq(halb, { ok: false, grund: 'kein gültiges JSON' }, 'halb geschriebene Show → kein gültiges JSON');
  eq(JSON.stringify(halb).includes('Geheimname'), false, 'Grund enthält keinen Dateiinhalt (G6)');
  eq(leseShowSicher(join(tmp, 'Shows')).ok, false, 'Ordner statt Datei → nicht lesbar, wirft nicht');
  writeFileSync(showPfad, '[1,2]');
  eq(leseShowSicher(showPfad), { ok: false, grund: 'keine Show-Datei' }, 'JSON ohne Objekt → keine Show-Datei');
  writeFileSync(
    showPfad,
    JSON.stringify({
      schemaVersion: 1,
      name: 'Tag 1',
      tools: [
        { appId: 'jm-timer', settings: { timetable: [{ label: 'X', durationMs: 1000 }] } },
        { appId: 'jm-rundown', document: 'rd/tag1.jmrundown' },
      ],
      ablauf: [{ id: 'u1', label: 'A' }, { label: 'B' }, { label: 'B' }, { id: 'u1', label: 'C' }],
    }),
  );
  const gut = leseShowSicher(showPfad);
  eq(gut.ok, true, 'reparierte Show wieder lesbar (das nächste RELOAD heilt)');
  if (gut.ok) {
    eq(gut.show.name, 'Tag 1', 'Show-Name gelesen');
    eq(gut.ablaufSchluessel, ['u1', 'ersatz:B', 'ersatz:B#2', 'u1#2'], 'Schlüssel: Kennung, Ersatz-Kennungen, Doppelte aufgelöst');
    eq(gut.eigeneTimerListe, true, 'eigene Timer-Liste erkannt');
    eq(rundownDateiDerShow(showPfad, gut.show), join(tmp, 'Shows', 'rd', 'tag1.jmrundown'), 'eigene Rundown-Datei relativ zur Show (4.8)');
  }
  const absolutRd = join(tmp, 'absolut.jmrundown');
  writeFileSync(
    showPfad,
    JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [{ appId: 'jm-rundown', document: absolutRd }] }),
  );
  const ohneAblauf = leseShowSicher(showPfad);
  eq(ohneAblauf.ok ? [ohneAblauf.ablaufSchluessel, ohneAblauf.eigeneTimerListe] : null, [[], false], 'Show ohne Ablauf → keine Schlüssel, keine Timer-Liste');
  eq(ohneAblauf.ok ? rundownDateiDerShow(showPfad, ohneAblauf.show) : 'x', absolutRd, 'absoluter Verweis bleibt absolut');
  writeFileSync(showPfad, JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [] }));
  const ohneVerweis = leseShowSicher(showPfad);
  eq(ohneVerweis.ok ? rundownDateiDerShow(showPfad, ohneVerweis.show) : 'x', null, 'ohne Verweis → null');

  // ── dateiStand (4.8) ───────────────────────────────────────────────────────
  const rdPfad = join(tmp, 'eigen.jmrundown');
  writeFileSync(rdPfad, '{"a":1}');
  const st = dateiStand(rdPfad);
  eq(st ? [st.pfad, st.groesse, /^[0-9a-f]{64}$/.test(st.sha256), st.mtimeMs > 0] : null, [rdPfad, 7, true, true], 'dateiStand: Pfad, Größe, SHA-256, Änderungszeit');
  writeFileSync(rdPfad, '{"a":2}');
  const st2 = dateiStand(rdPfad);
  eq(st2 !== null && st !== null && st2.groesse === st.groesse && st2.sha256 !== st.sha256, true, 'gleiche Größe, anderer Inhalt → anderer SHA-256');
  eq(dateiStand(join(tmp, 'fehlt.jmrundown')), null, 'fehlende Datei → null');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
