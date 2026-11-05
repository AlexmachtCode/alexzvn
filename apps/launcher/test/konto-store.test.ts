// Anmeldung im Launcher, Store des Kontos (Z1-L2): der echte Zustand-Store gegen eine Attrappe von window.jmps. Ohne Electron, ohne
// Fenster; die Aliase (@/, @shared/) löst tsconfig.web.json auf:
//   npm run selftest:konto -w @jm/launcher   (tsx --tsconfig tsconfig.web.json; Form „ck“)
import type { AdminUebersicht, KontoAnsicht, KontoFehlerCode, KontoStand } from '../src/shared/konto';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Attrappe von window.jmps: jede nicht genannte Methode antwortet leer ──
const aufrufe: Record<string, number> = {};
const antworten: Record<string, (...a: unknown[]) => unknown> = {};
const jmps = new Proxy({}, {
  get: (_t, name: string) => (...a: unknown[]) => {
    aufrufe[name] = (aufrufe[name] ?? 0) + 1;
    return Promise.resolve(antworten[name] ? antworten[name](...a) : undefined);
  },
});
let fokus: (() => void) | null = null;
(globalThis as unknown as { window: unknown }).window = {
  jmps,
  addEventListener: (art: string, f: () => void) => { if (art === 'focus') fokus = f; },
};
const warte = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

const { useKonto } = await import('../src/renderer/src/store/konto');
const { useTools } = await import('../src/renderer/src/store/tools');

const JETZT = Date.now();
function stand(): KontoStand {
  return {
    kid: 'k1', email: 'maria@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'admin', tools: [], events: [], zoom: true,
    zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: JETZT - 1000, exp: JETZT + 86_400_000, kontoBis: null, angemeldetSeit: JETZT - 1000,
  };
}
function ansicht(zustand: 'nicht-angemeldet' | 'angemeldet'): KontoAnsicht {
  return {
    zustand, stand: zustand === 'angemeldet' ? stand() : null, grund: null, gueltigBis: null, rechnerName: 'REGIE-01', plattform: 'win',
    hinweise: [], devVariablen: [], zoomAnfrage: null, adminOffen: 0, ausgaben: [], letztePruefung: null,
  };
}
const leer = (k: string): AdminUebersicht => ({
  zugaenge: [{ kid: k, email: `${k}@partner.de`, name: k, art: 'passwort', stufe: 'externer', zustand: 'aktiv', tools: [], events: [], bis: null, zoomBis: null,
    einladungBis: null, letzteAnmeldung: null, ersterAdmin: false }],
  iveo: [], anfragen: [], geraete: [], altKey: { bis: null, diagnose: null, zeilen: [] },
});

// --- AR75: Aktion geklappt, Folge-Übersicht gescheitert ---------------------------------------------------------------------------
{
  const alt = leer('alt');
  const neu = leer('neu');
  useKonto.setState({ adminOffen: true, admin: { daten: alt, laedt: false, fehler: null } });

  antworten.kontoAdminAktion = () => ({ ok: true, ergebnis: { ok: true, einladungscode: 'CODE-1', codeBis: JETZT }, daten: neu });
  let r = await useKonto.getState().adminAktion({ aktion: 'zugang-loeschen', kid: 'x' });
  ck('Z1-L2 AR75: mit neuer Übersicht ersetzt der Store die Daten und löscht den Fehler',
    r.ok && useKonto.getState().admin.daten === neu && useKonto.getState().admin.fehler === null);

  useKonto.setState({ admin: { daten: alt, laedt: false, fehler: null } });
  antworten.kontoAdminAktion = () => ({ ok: true, ergebnis: { ok: true, einladungscode: 'CODE-2', codeBis: JETZT }, daten: null, uebersichtFehler: 'netz' });
  r = await useKonto.getState().adminAktion({ aktion: 'einladen', email: 'a@b.de', name: 'A', tools: [], events: [], bis: JETZT });
  ck('Z1-L2 AR75: ohne Übersicht (daten null) bleiben die bisherigen Daten stehen und der Fehler der Übersicht steht im Store',
    useKonto.getState().admin.daten === alt && useKonto.getState().admin.fehler === 'netz' && useKonto.getState().admin.laedt === false);
  ck('Z1-L2 AR75: das Ergebnis der Aktion (Einladungscode) geht trotzdem an den Aufrufer',
    r.ok && r.ergebnis.einladungscode === 'CODE-2');

  useKonto.setState({ admin: { daten: alt, laedt: false, fehler: null } });
  antworten.kontoAdminAktion = () => ({ ok: true, ergebnis: { ok: true }, daten: null });
  await useKonto.getState().adminAktion({ aktion: 'entsperren', kid: 'x' });
  ck('Z1-L2 AR75: ohne Code der Übersicht gilt der allgemeine Serverfehler, die Daten bleiben', useKonto.getState().admin.daten === alt && useKonto.getState().admin.fehler === 'server');

  // OFP4: meldet die Folge-Abfrage „kein Recht“, fragt der Store noch einmal und schließt die Maske mit M5.
  useKonto.setState({ adminOffen: true, admin: { daten: alt, laedt: false, fehler: null } });
  useTools.getState().setNotice(null);
  antworten.kontoAdminAktion = () => ({ ok: true, ergebnis: { ok: true }, daten: null, uebersichtFehler: 'kein-recht' as KontoFehlerCode });
  antworten.kontoAdminUebersicht = () => ({ ok: false, code: 'kein-recht' });
  await useKonto.getState().adminAktion({ aktion: 'entsperren', kid: 'x' });
  await warte();
  ck('Z1-L2 AR75, OFP4: „kein Recht“ aus der Folge-Abfrage schließt die Maske, räumt die Daten weg und meldet M5',
    useKonto.getState().adminOffen === false && useKonto.getState().admin.daten === null
    && useTools.getState().notice === 'Du bist kein Admin mehr. Die Admin-Maske ist geschlossen.');

  // Die Aktion selbst scheitert: nichts am Stand ändern.
  useKonto.setState({ adminOffen: true, admin: { daten: alt, laedt: false, fehler: null } });
  antworten.kontoAdminAktion = () => ({ ok: false, code: 'konflikt' });
  const f = await useKonto.getState().adminAktion({ aktion: 'zugang-loeschen', kid: 'x' });
  ck('Z1-L2: scheitert die Aktion selbst, bleibt der Stand unverändert und der Code geht zurück',
    !f.ok && f.code === 'konflikt' && useKonto.getState().admin.daten === alt && useKonto.getState().admin.fehler === null);
}

// --- Lage bei Fensterfokus: ein Wechsel der Sitzung holt Einstellungen und Updates neu (uebernimm) -------------------------------
{
  antworten.kontoAnsicht = () => ansicht('nicht-angemeldet');
  antworten.kontoLage = () => ansicht('angemeldet');
  antworten.getSettings = () => ({});
  await useKonto.getState().lade();
  await warte();
  const vorher = aufrufe.getSettings ?? 0;
  const cu = aufrufe.checkUpdates ?? 0;
  ck('Z1-L2: vor dem Fokus ist niemand angemeldet', useKonto.getState().ansicht?.zustand === 'nicht-angemeldet' && fokus !== null);
  fokus?.();
  await warte();
  ck('Z1-L2: Fokus mit Wechsel „ohne“ → „mit gültiger Sitzung“ übernimmt die Ansicht UND holt Einstellungen und Update-Hinweise',
    useKonto.getState().ansicht?.zustand === 'angemeldet' && (aufrufe.getSettings ?? 0) === vorher + 1 && (aufrufe.checkUpdates ?? 0) === cu + 1);
  fokus?.();
  await warte();
  ck('Z1-L2: Fokus ohne Wechsel holt nichts neu', (aufrufe.getSettings ?? 0) === vorher + 1 && (aufrufe.checkUpdates ?? 0) === cu + 1);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
