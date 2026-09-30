// Selbsttest der reinen Launcher-Helfer - ohne Electron, ohne Fenster:
//   node --experimental-strip-types test/selftest.ts
import { startShowTools } from '../src/main/show-launch.ts';
import { PresenceStore, gueltigerVerbund } from '../src/main/presence-store.ts';
import { kopfanzeige, kopfEingang, type KopfEingang } from '../src/renderer/src/lib/kopfanzeige.ts';
import { toolVerbundText, zeigeCode } from '../src/renderer/src/lib/verbund-texte.ts';
import type { VerbundStand } from '../src/shared/types.ts';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

// --- Show starten: was gilt als "nicht verfuegbar"? -------------------------
// GEMESSEN am Code (Ist-Karte 30.09.2026): der Start meldete ein installiertes,
// aber nicht startbares Tool mit seinem ANZEIGENAMEN als fehlend, ein
// unbekanntes mit seiner appId - das Start-Overlay vergleicht aber nur appIds.
// Folge: ein fehlendes Tool stand 30 s auf "startet…" statt auf "nicht
// verfuegbar", und fuer den Bediener sah das aus wie "oeffnet nicht".
{
  const tools: Record<string, { name: string; startbar: boolean }> = {
    'jm-timer': { name: 'JM Timer', startbar: true },
    'jm-titler': { name: 'JM Titler', startbar: false },   // installiert, Start scheitert
  };
  const refs = [{ appId: 'jm-timer' }, { appId: 'jm-titler' }, { appId: 'jm-unbekannt' }];
  const r = await startShowTools(
    refs,
    (appId) => tools[appId],
    async (tool) => ({ ok: tool.startbar }),
  );
  ck('ein Tool gestartet', r.launched === 1);
  ck('fehlende Tools stehen als appId in missing - fuer das Overlay',
    JSON.stringify(r.missing) === JSON.stringify(['jm-titler', 'jm-unbekannt']));
  ck('fuer die Logzeile gibt es die Anzeigenamen (unbekannt: appId)',
    JSON.stringify(r.missingNames) === JSON.stringify(['JM Titler', 'jm-unbekannt']));
}
{
  const r = await startShowTools([], () => undefined, async () => ({ ok: true }));
  ck('leere Show: nichts gestartet, nichts fehlt', r.launched === 0 && r.missing.length === 0);
}

// --- Presence: Verbund-Zustand der Tools (Master-Link Teil 1, Spec 5.2) -----
// Vorher meldete der Hub nur Start/Stopp (Signatur appId@version): ein Wechsel
// "verbunden" -> "fehler:zeit" kam bei offenem Launcher nie in der Anzeige an.
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello', verbund: 'verbunden' });
  ck('hello meldet einmal', meldungen === 1);
  s.verarbeite({ appId: 'jm-timer', event: 'beat', verbund: 'verbunden' });
  ck('gleicher Zustand meldet nicht erneut', meldungen === 1);
  s.verarbeite({ appId: 'jm-timer', event: 'beat', verbund: 'fehler:zeit' });
  ck('Wechsel des Verbund-Zustands meldet genau einmal', meldungen === 2);
  ck('Snapshot traegt den Zustand', s.snapshot()[0].verbund === 'fehler:zeit');
  s.verarbeite({ appId: 'jm-timer', event: 'beat' });
  ck('Beat ohne Feld (alter Tool-Stand) -> verbund undefined', s.snapshot()[0].verbund === undefined);
  ck('gueltigerVerbund lehnt Muell ab', gueltigerVerbund('rm -rf') === undefined && gueltigerVerbund(42) === undefined);
  ck('gueltigerVerbund nimmt fehler:<code>', gueltigerVerbund('fehler:nicht-gefunden') === 'fehler:nicht-gefunden');
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  ck('bye meldet', meldungen === 4 && !s.snapshot()[0].running);
  s.verarbeite({ appId: 'jm-qa', name: 'JM Q&A', version: '0.3.0', pid: 2, event: 'hello', logDir: 'C:/logs/qa' });
  ck('logQuellen: nur Tools mit logDir (Log-Anhang im Feedback)',
    JSON.stringify(s.logQuellen()) === JSON.stringify([{ appId: 'jm-qa', name: 'JM Q&A', logDir: 'C:/logs/qa' }]));
}
{
  let jetzt = 1000;
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; }, () => jetzt, 25_000);
  s.verarbeite({ appId: 'jm-qa', event: 'hello' });
  jetzt += 26_000;
  s.pruefe();
  ck('ohne Lebenszeichen nach 25 s gestoppt (Sweep meldet)', meldungen === 2 && !s.snapshot()[0].running);
}

// --- Presence: ein beendetes Tool wird durch einen verspaeteten Beat nicht wiederbelebt ---
// app-runtime sendet Beat und bye als getrennte HTTP-Requests; ein Beat kann nach dem
// bye eintreffen. Die Anzeige darf das beendete Tool nicht bis zu 25 s als laufend
// zeigen (Owner-Grundsatz: eine dauerhafte Anzeige luegt nicht).
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello' });
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  const nachBye = meldungen;
  const gesehen = s.snapshot()[0].lastSeen;
  s.verarbeite({ appId: 'jm-timer', event: 'beat' });
  ck('bye -> verspaeteter beat (ohne pid): bleibt gestoppt, keine Meldung',
    !s.snapshot()[0].running && meldungen === nachBye && s.snapshot()[0].lastSeen === gesehen);
  s.verarbeite({ appId: 'jm-timer', event: 'beat', pid: 1 });
  ck('bye -> verspaeteter beat (gleiche pid): bleibt gestoppt, keine Meldung',
    !s.snapshot()[0].running && meldungen === nachBye);
}
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello' });
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  const nachBye = meldungen;
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello' });
  ck('bye -> hello (neue Instanz): laeuft wieder, genau eine weitere Meldung',
    s.snapshot()[0].running && meldungen === nachBye + 1);
}
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello' });
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  const nachBye = meldungen;
  s.verarbeite({ appId: 'jm-timer', event: 'beat', pid: 2 });
  ck('bye -> beat mit ANDERER pid (Neustart ohne hello): laeuft wieder, eine Meldung',
    s.snapshot()[0].running && s.snapshot()[0].pid === 2 && meldungen === nachBye + 1);
}
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 7, event: 'beat' });
  ck('frischer Store (Launcher-Neustart bei laufendem Tool): beat ohne hello -> laeuft',
    s.snapshot()[0].running && meldungen === 1);
}

// --- Kopfanzeige: JEDE Zeile der Tabelle Spec 5.4 ---------------------------
// Dauerhafte Anzeigen luegen, wenn ein Zustand fehlt (#208: sechs Faelle).
{
  const k = false;
  const n = 'Regie-PC';
  const faelle: Array<[KopfEingang, string, string]> = [
    [{ rolle: 'aus' }, 'Verbund aus', 'gedaempft'],
    [{ rolle: 'master', zustand: 'startet', karteFehlt: k }, 'Master startet…', 'gedaempft'],
    [{ rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: k }, 'Master · noch keine Rechner', 'neutral'],
    [{ rolle: 'master', zustand: 'laeuft', n: 2, m: 2, karteFehlt: k }, 'Master · 2/2 Rechner online', 'gruen'],
    [{ rolle: 'master', zustand: 'laeuft', n: 1, m: 2, karteFehlt: k }, 'Master · 1/2 Rechner online', 'gelb'],
    [{ rolle: 'master', zustand: 'port-belegt', karteFehlt: k }, 'Master: Port 8738 belegt', 'rot'],
    [{ rolle: 'master', zustand: 'daten-beschaedigt', karteFehlt: k }, 'Master: Verbunddaten beschädigt', 'rot'],
    [{ rolle: 'master', zustand: 'lausch-fehler', errCode: 'EACCES', karteFehlt: k }, 'Master-Fehler: EACCES', 'rot'],
    [{ rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt: k }, 'Nicht gekoppelt: Master wählen', 'gedaempft'],
    [{ rolle: 'slave', zustand: 'koppelt', name: n, karteFehlt: k }, 'Koppeln mit Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'sucht', name: n, karteFehlt: k }, 'Suche Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'verbindet', name: n, karteFehlt: k }, 'Verbinde mit Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'verbunden', name: n, karteFehlt: k }, 'Regie-PC ●', 'gruen'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: n, karteFehlt: k }, 'Regie-PC sichtbar, Port gesperrt: Firewall?', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'nicht-gefunden', name: n, karteFehlt: k }, 'Regie-PC nicht erreichbar', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'verweigert', name: n, karteFehlt: k }, 'Regie-PC: Master-Modus aus?', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'netz', name: n, karteFehlt: k }, 'Regie-PC: Netz nicht erreichbar', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'kein-master', name: n, karteFehlt: k }, 'Adresse antwortet nicht als Master', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zertifikat', name: n, karteFehlt: k }, 'Anderer Master unter dieser Adresse', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'uhr', name: n, karteFehlt: k }, 'Uhrzeit prüfen', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'protokoll', name: n, karteFehlt: k }, 'Versionen angleichen', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'unbekannt', name: n, karteFehlt: k }, 'Vom Master entfernt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'signatur', name: n, karteFehlt: k }, 'Anmeldung abgelehnt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'ersetzt', name: n, karteFehlt: k }, 'Kennung doppelt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'datei', name: n, karteFehlt: k }, 'Kopplung beschädigt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'sonstig', errCode: 'ECONNRESET', name: n, karteFehlt: k }, 'Verbindungsfehler ECONNRESET', 'rot'],
  ];
  let alle = true;
  for (const [ein, text, farbe] of faelle) {
    const aus = kopfanzeige(ein);
    if (aus.text !== text || aus.farbe !== farbe) {
      alle = false;
      console.log(`      erwartet "${text}"/${farbe}, ist "${aus.text}"/${aus.farbe}`);
    }
  }
  ck(`Kopfanzeige: alle ${faelle.length} Zeilen der Tabelle 5.4`, alle);

  // Vorrang „Karte fehlt“: gruen/neutral -> gelb + Hinweis; gelb/gedaempft -> Hinweis; rot -> unveraendert
  const kf = (e: KopfEingang) => kopfanzeige(e);
  ck('Karte fehlt: gruen -> gelb + Hinweis',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'verbunden', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Regie-PC ● · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: neutral -> gelb',
    JSON.stringify(kf({ rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: true })) === JSON.stringify({ text: 'Master · noch keine Rechner · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: gelb bleibt gelb, Hinweis angehaengt',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'sucht', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Suche Regie-PC… · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: rot bleibt unveraendert (Text UND Farbe)',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Regie-PC sichtbar, Port gesperrt: Firewall?', farbe: 'rot' }));

  // Abbildung Stand -> Eingang: n/m zaehlen nur FREMDE Rechner
  const basis: VerbundStand = { rolle: 'master', rechnerName: 'A', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null, master: null, slave: null };
  const rechner = (id: string, dieser: boolean, online: boolean) =>
    ({ rechnerId: id, name: id, dieserRechner: dieser, online, zuletztGesehen: null, adresse: null, tools: [] });
  const m = {
    zustand: 'laeuft' as const, fehlerCode: null, name: 'Regie-PC', fpKurz: 'ab', ausBak: false,
    rechner: [rechner('a', true, true), rechner('b', false, true), rechner('c', false, false)],
    kopplung: { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false },
  };
  ck('kopfEingang: n/m ohne „dieser Rechner“',
    JSON.stringify(kopfEingang({ ...basis, master: m })) === JSON.stringify({ rolle: 'master', zustand: 'laeuft', n: 1, m: 2, karteFehlt: false }));
  const sl = { gekoppelt: true, koppeltGerade: false, masterName: 'Regie-PC', festeAdresse: null, gefundeneMaster: [], client: { art: 'aus' as const } };
  ck('kopfEingang: gekoppelt, Client noch aus -> sucht',
    kopfEingang({ ...basis, rolle: 'slave', slave: sl }).rolle === 'slave' && (kopfEingang({ ...basis, rolle: 'slave', slave: sl }) as { zustand: string }).zustand === 'sucht');
  ck('kopfEingang: nicht gekoppelt',
    (kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false } }) as { zustand: string }).zustand === 'nicht-gekoppelt');

  // kopfEingang: die übrigen Zweige Stand -> Eingang (die Kopfanzeige ist dauerhaft sichtbar)
  const ke = (s: VerbundStand) => JSON.stringify(kopfEingang(s));
  ck('kopfEingang: Master ohne Stand -> startet',
    ke({ ...basis, master: null }) === JSON.stringify({ rolle: 'master', zustand: 'startet', karteFehlt: false }));
  ck('kopfEingang: lausch-fehler traegt den errCode',
    ke({ ...basis, master: { ...m, zustand: 'lausch-fehler', fehlerCode: 'EACCES' } }) === JSON.stringify({ rolle: 'master', zustand: 'lausch-fehler', errCode: 'EACCES', karteFehlt: false }));
  ck('kopfEingang: port-belegt durchgereicht',
    ke({ ...basis, master: { ...m, zustand: 'port-belegt' } }) === JSON.stringify({ rolle: 'master', zustand: 'port-belegt', karteFehlt: false }));
  ck('kopfEingang: koppelt gerade geht vor „nicht gekoppelt“',
    (kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false, koppeltGerade: true } }) as { zustand: string }).zustand === 'koppelt');
  ck('kopfEingang: beim Start beschädigte Datei (keine Kopplung, Client „datei“) -> rot „Kopplung beschädigt“',
    JSON.stringify(kopfanzeige(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false, client: { art: 'fehler', code: 'datei' } } })))
      === JSON.stringify({ text: 'Kopplung beschädigt: neu koppeln', farbe: 'rot' }));
  ck('kopfEingang: master-link.json nicht lesbar -> rot, weder „Verbund aus“ noch „neu koppeln“ (Spec 7.3)',
    JSON.stringify(kopfanzeige(kopfEingang({ ...basis, rolle: 'aus', dateiFehler: 'EBUSY' })))
      === JSON.stringify({ text: 'Kopplungsdatei gesperrt: EBUSY', farbe: 'rot' }));
  ck('kopfEingang: verbunden',
    ke({ ...basis, rolle: 'slave', slave: { ...sl, client: { art: 'verbunden', adresse: '10.0.0.1', seit: 1 } } }) === JSON.stringify({ rolle: 'slave', zustand: 'verbunden', name: 'Regie-PC', karteFehlt: false }));
  ck('kopfEingang: fehler mit code und errCode',
    ke({ ...basis, rolle: 'slave', slave: { ...sl, client: { art: 'fehler', code: 'sonstig', errCode: 'ECONNRESET' } } }) === JSON.stringify({ rolle: 'slave', zustand: 'fehler', code: 'sonstig', name: 'Regie-PC', errCode: 'ECONNRESET', karteFehlt: false }));
  ck('kopfEingang: Karte fehlt wird durchgereicht',
    (kopfEingang({ ...basis, karteFehlt: true, master: m }) as { karteFehlt: boolean }).karteFehlt === true);

  // Tool-Zeilen am Slave (Spec 5.2)
  ck('Tool ohne Feld: „noch ohne Verbund (Update nötig)“', toolVerbundText(undefined, false)?.text === 'läuft, noch ohne Verbund (Update nötig)');
  ck('Rolle aus: keine Verbund-Zeile', toolVerbundText('verbunden', true) === null);
  ck('fehler:zeit wird kurz benannt', toolVerbundText('fehler:zeit', false)?.text === 'Master sichtbar, Port gesperrt');
  ck('Code-Anzeige XXXXX-XXXXX', zeigeCode('K7QXM3PRTH') === 'K7QXM-3PRTH');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
