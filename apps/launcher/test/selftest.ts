// Selbsttest der reinen Launcher-Helfer - ohne Electron, ohne Fenster:
//   node --experimental-strip-types test/selftest.ts
import { startShowTools } from '../src/main/show-launch.ts';
import { PresenceStore, gueltigerVerbund } from '../src/main/presence-store.ts';
import { kopfanzeige, kopfEingang, kopfText, kopfZeile, type KopfEingang } from '../src/renderer/src/lib/kopfanzeige.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { beimSchliessen } from '../src/renderer/src/lib/verbund-schliessen.ts';
import {
  ablehnungText, codeFeldLeeren, koppelnMoeglich, neueKennungAnbieten, speicherFehlerText, toolVerbundText, toolZeilen, zeigeCode,
} from '../src/renderer/src/lib/verbund-texte.ts';
import type { VerbundClientStand, VerbundStand } from '../src/shared/types.ts';
import { ANHANG_TEXTE, anhangAnzeige, anhangListeSchritt, leererAnhangZustand, type AnhangListenZustand } from '../src/renderer/src/lib/anhang-liste.ts';
import type { IveoMaterialRef } from '../src/shared/types.ts';
import { gestoerteSideEvents, kopfzeile, ORDNER_ZEILEN_TEXTE, ordnerZeile, weitereSideEvents } from '../src/renderer/src/lib/ordner-zeilen.ts';
import type { AnhangOrdnerStand, OrdnerProblem, SideEventOrdnerStand } from '../src/shared/types.ts';
import { holeAlleSeiten, RELEASES_MAX_SEITEN } from '../src/main/release-liste.ts';

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

  // Client-Fehler OHNE code (der Typ erlaubt es): die dauerhafte Anzeige darf nie „Suche …“ in gelb lügen (Spec 5.4, #208)
  const kfs = (client: VerbundClientStand, karteFehlt = false) =>
    JSON.stringify(kopfanzeige(kopfEingang({ ...basis, karteFehlt, rolle: 'slave', slave: { ...sl, client } })));
  ck('kopfEingang: fehler ohne code bleibt rot (Verbindungsfehler), nie „Suche“/gelb',
    kfs({ art: 'fehler' }) === JSON.stringify({ text: 'Verbindungsfehler unbekannt', farbe: 'rot' }));
  ck('kopfEingang: fehler ohne code, aber mit errCode -> rot mit errCode',
    kfs({ art: 'fehler', errCode: 'ECONNRESET' }) === JSON.stringify({ text: 'Verbindungsfehler ECONNRESET', farbe: 'rot' }));
  ck('kopfEingang: fehler ohne code + Karte fehlt bleibt rot und unverändert',
    kfs({ art: 'fehler' }, true) === JSON.stringify({ text: 'Verbindungsfehler unbekannt', farbe: 'rot' }));

  // Fremdtexte kommen nie ungekürzt in den Kopf: Namen 60, Fehlercodes 32 ganze Zeichen (Codepoints, Spec Namen ≤ 60)
  const verb = (masterName: string) =>
    kopfanzeige(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, masterName, client: { art: 'verbunden', adresse: '10.0.0.1', seit: 1 } } })).text;
  ck('Kürzung: Master-Name mit 100 Zeichen -> 60', verb('x'.repeat(100)) === `${'x'.repeat(60)} ●`);
  ck('Kürzung: genau 60 Zeichen bleiben, Umlaute unverändert',
    verb('Ü'.repeat(60)) === `${'Ü'.repeat(60)} ●` && verb('Saal Überlingen') === 'Saal Überlingen ●');
  ck('Kürzung: Emoji werden nie mittendrin zerschnitten (Codepoints)',
    verb('😀'.repeat(70)) === `${'😀'.repeat(60)} ●` && verb('😀'.repeat(61)) === `${'😀'.repeat(60)} ●` && verb('😀'.repeat(60)) === `${'😀'.repeat(60)} ●`);
  ck('Kürzung: Name auch im Fehler- und Such-Kopf',
    kopfanzeige(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, masterName: 'n'.repeat(100), client: { art: 'fehler', code: 'nicht-gefunden' } } })).text === `${'n'.repeat(60)} nicht erreichbar`
    && kopfanzeige(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, masterName: 'n'.repeat(100) } })).text === `Suche ${'n'.repeat(60)}…`);
  ck('Kürzung: errCode des Masters (lausch-fehler) auf 32',
    kopfanzeige(kopfEingang({ ...basis, master: { ...m, zustand: 'lausch-fehler', fehlerCode: 'E'.repeat(100) } })).text === `Master-Fehler: ${'E'.repeat(32)}`);
  ck('Kürzung: errCode des Clients (sonstig) auf 32',
    kfs({ art: 'fehler', code: 'sonstig', errCode: '😀'.repeat(50) }) === JSON.stringify({ text: `Verbindungsfehler ${'😀'.repeat(32)}`, farbe: 'rot' }));
  ck('Kürzung: dateiFehler auf 32',
    kopfanzeige(kopfEingang({ ...basis, rolle: 'aus', dateiFehler: 'X'.repeat(100) })).text === `Kopplungsdatei gesperrt: ${'X'.repeat(32)}`);
  ck('Kürzung: kurzer errCode bleibt wörtlich',
    kopfanzeige(kopfEingang({ ...basis, master: { ...m, zustand: 'lausch-fehler', fehlerCode: 'EACCES' } })).text === 'Master-Fehler: EACCES');

  // Tool-Zeilen am Slave (Spec 5.2)
  ck('Tool ohne Feld: „noch ohne Verbund (Update nötig)“', toolVerbundText(undefined, false)?.text === 'läuft, noch ohne Verbund (Update nötig)');
  ck('Tool: unbekannter fehler:-Code wird auf 32 Zeichen gekürzt, rot',
    JSON.stringify(toolVerbundText(`fehler:${'x'.repeat(100)}`, false)) === JSON.stringify({ text: `Fehler (${'x'.repeat(32)})`, ton: 'rot' }));
  ck('Tool: Fremdwert ohne fehler:-Präfix wird auf 32 Zeichen gekürzt, rot',
    JSON.stringify(toolVerbundText('😀'.repeat(50), false)) === JSON.stringify({ text: `Fehler (${'😀'.repeat(32)})`, ton: 'rot' }));
  ck('Rolle aus: keine Verbund-Zeile', toolVerbundText('verbunden', true) === null);
  ck('fehler:zeit wird kurz benannt', toolVerbundText('fehler:zeit', false)?.text === 'Master sichtbar, Port gesperrt');
  ck('Code-Anzeige XXXXX-XXXXX', zeigeCode('K7QXM3PRTH') === 'K7QXM-3PRTH');

  // Abgelehnte IPC-Aufrufe des Verbunds (Schreibfehler, gesperrte Datei): Electron reicht dem Renderer nur den TEXT
  // („Error invoking remote method …: Error: EPERM: …, rename 'C:\…'“), nicht das Feld code. Angezeigt wird nur der
  // Code — nie der Text, denn der nennt Pfade und kann Fremdinhalte zitieren.
  const ABGELEHNT = (code: string): string => `Nicht gespeichert (${code}). Bitte noch einmal versuchen.`;
  const electronFehler = (code: string): Error =>
    new Error(`Error invoking remote method 'verbund:rolle': Error: ${code}: operation not permitted, rename 'C:\\Users\\EXAMPLE\\master-link.json.tmp' -> 'C:\\Users\\EXAMPLE\\master-link.json'`);
  ck('Ablehnung: Code aus dem Electron-Text, ohne Pfad',
    ablehnungText(electronFehler('EPERM')) === ABGELEHNT('EPERM'));
  ck('Ablehnung: Feld code hat Vorrang (Aufruf ohne IPC)',
    ablehnungText(Object.assign(new Error('x'), { code: 'EBUSY' })) === ABGELEHNT('EBUSY'));
  ck('Ablehnung: Node-Codes mit Unterstrich und Ziffern (ERR_OSSL_…)',
    ablehnungText(new Error('Error: ERR_OSSL_ASN1_ILLEGAL_PADDING: x')) === ABGELEHNT('ERR_OSSL_ASN1_ILLEGAL_PADDING'));
  ck('Ablehnung: ohne erkennbaren Code → UNBEKANNT, Fremdtext bleibt draußen',
    ablehnungText(new Error('kaputt: geheimer Text')) === ABGELEHNT('UNBEKANNT'));
  ck('Ablehnung: kein Error-Objekt → UNBEKANNT',
    ablehnungText('EPERM') === ABGELEHNT('UNBEKANNT') && ablehnungText(undefined) === ABGELEHNT('UNBEKANNT'));
  ck('Ablehnung: überlanger Code wird auf 32 Zeichen gekürzt',
    ablehnungText(new Error(`E${'A'.repeat(100)}`)) === ABGELEHNT(`E${'A'.repeat(31)}`));

  // Der Code wird an den Electron-Rahmen gebunden: er steht direkt nach „Error invoking remote method …: Error: “ bzw.
  // am Anfang der eigentlichen Meldung — nie irgendwo im Fremdtext (Pfad C:\Users\EDV, zitierte Namen).
  ck('Ablehnung: ein großgeschriebenes E-Wort im Pfad ist kein Code (Pfad C:\\Users\\EDV)',
    ablehnungText(new Error(`Error invoking remote method 'verbund:rolle': Error: kaputt 'C:\\Users\\EDV\\master-link.json'`)) === ABGELEHNT('UNBEKANNT')
    && ablehnungText(new Error('Fehler in C:\\Users\\EDV\\x: EPERM')) === ABGELEHNT('UNBEKANNT'));
  ck('Ablehnung: Meldung, die nur so ähnlich anfängt („EDV-Anlage …“), ist kein Code',
    ablehnungText(new Error("Error invoking remote method 'verbund:rolle': Error: EDV-Anlage nicht erreichbar")) === ABGELEHNT('UNBEKANNT'));
  ck('Ablehnung: der Code steht erst nach dem Rahmen (ohne Fehlerklassen-Präfix und mit anderer Klasse)',
    ablehnungText(new Error("Error invoking remote method 'verbund:rolle': EACCES: permission denied")) === ABGELEHNT('EACCES')
    && ablehnungText(new Error("Error invoking remote method 'verbund:rolle': TypeError: ENOENT: x")) === ABGELEHNT('ENOENT'));
  // Ein Koppel-Aufruf, dessen Leitung ausfällt, ist nichts „Nicht gespeichert“: eigener Text.
  ck('Ablehnung beim Koppeln: eigener Text mit demselben Code-Muster',
    ablehnungText(electronFehler('ECONNRESET'), 'koppeln') === 'Koppeln fehlgeschlagen (ECONNRESET). Bitte noch einmal versuchen.'
    && ablehnungText(new Error('kaputt'), 'koppeln') === 'Koppeln fehlgeschlagen (UNBEKANNT). Bitte noch einmal versuchen.'
    && !ablehnungText(electronFehler('EPERM'), 'koppeln').includes('gespeichert'));
  ck('Ablehnung bei Anstößen (Suche, Abbrechen, Kopplungsfenster): eigener Text, nie „Nicht gespeichert“',
    ablehnungText(electronFehler('EPIPE'), 'anstossen') === 'Aktion fehlgeschlagen (EPIPE). Bitte noch einmal versuchen.');

  // Kopfanzeige bei 980 px: nur der Namensteil darf gekürzt werden. kopfZeile() trennt vor · Name · nach; die Anzeige
  // kürzt NUR den Namen (eigenes truncate), Statusteil, Code und „· Karte fehlt“ stehen vollständig daneben.
  const LANG = 'N'.repeat(60);
  const c32 = 'C'.repeat(32);
  // [Eingang, vor, Name, nach, hinweis] mit dem 60-Zeichen-Namen bzw. dem 32-Zeichen-Code (längster fester Text jeder Zeile)
  const zeilen: Array<[KopfEingang, string, string, string, string?]> = [
    [{ rolle: 'aus' }, 'Verbund aus', '', ''],
    [{ rolle: 'gesperrt', errCode: c32 }, `Kopplungsdatei gesperrt: ${c32}`, '', ''],
    [{ rolle: 'master', zustand: 'startet', karteFehlt: true }, `Master startet…`, '', '', '· Karte fehlt'],
    [{ rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: true }, `Master · noch keine Rechner`, '', '', '· Karte fehlt'],
    [{ rolle: 'master', zustand: 'laeuft', n: 10, m: 12, karteFehlt: true }, `Master · 10/12 Rechner online`, '', '', '· Karte fehlt'],
    [{ rolle: 'master', zustand: 'laeuft', n: 12, m: 12, karteFehlt: true }, `Master · 12/12 Rechner online`, '', '', '· Karte fehlt'],
    [{ rolle: 'master', zustand: 'port-belegt', karteFehlt: true }, 'Master: Port 8738 belegt', '', ''],
    [{ rolle: 'master', zustand: 'daten-beschaedigt', karteFehlt: true }, 'Master: Verbunddaten beschädigt', '', ''],
    [{ rolle: 'master', zustand: 'lausch-fehler', errCode: c32, karteFehlt: true }, `Master-Fehler: ${c32}`, '', ''],
    [{ rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt: true }, `Nicht gekoppelt: Master wählen`, '', '', '· Karte fehlt'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'sonstig', errCode: c32, name: LANG, karteFehlt: true }, `Verbindungsfehler ${c32}`, '', ''],
    [{ rolle: 'slave', zustand: 'koppelt', name: LANG, karteFehlt: true }, 'Koppeln mit ', LANG, `…`, '· Karte fehlt'],
    [{ rolle: 'slave', zustand: 'sucht', name: LANG, karteFehlt: true }, 'Suche ', LANG, `…`, '· Karte fehlt'],
    [{ rolle: 'slave', zustand: 'verbindet', name: LANG, karteFehlt: true }, 'Verbinde mit ', LANG, `…`, '· Karte fehlt'],
    [{ rolle: 'slave', zustand: 'verbunden', name: LANG, karteFehlt: true }, '', LANG, ` ●`, '· Karte fehlt'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: LANG, karteFehlt: true }, '', LANG, ' sichtbar, Port gesperrt: Firewall?'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'nicht-gefunden', name: LANG, karteFehlt: true }, '', LANG, ' nicht erreichbar'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'verweigert', name: LANG, karteFehlt: true }, '', LANG, ': Master-Modus aus?'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'netz', name: LANG, karteFehlt: true }, '', LANG, ': Netz nicht erreichbar'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'kein-master', name: LANG, karteFehlt: true }, 'Adresse antwortet nicht als Master', '', ''],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zertifikat', name: LANG, karteFehlt: true }, 'Anderer Master unter dieser Adresse', '', ''],
    [{ rolle: 'slave', zustand: 'fehler', code: 'unbekannt', name: LANG, karteFehlt: true }, 'Vom Master entfernt: neu koppeln', '', ''],
    [{ rolle: 'slave', zustand: 'fehler', code: 'datei', name: LANG, karteFehlt: true }, 'Kopplung beschädigt: neu koppeln', '', ''],
  ];
  let alleTeile = true;
  for (const [ein, vor, name, nach, hinweis = ''] of zeilen) {
    const z = kopfZeile(ein);
    const k = kopfanzeige(ein);
    if (z.vor !== vor || z.name !== name || z.nach !== nach || z.hinweis !== hinweis || kopfText(z) !== k.text || z.farbe !== k.farbe) {
      alleTeile = false;
      console.log(`      ${JSON.stringify(ein)}: vor "${z.vor}" name (${z.name.length} Zeichen) nach "${z.nach}"`);
    }
  }
  ck(`Kopfzeile: ${zeilen.length} Zeilen mit längstem festen Text (Code 32, Name 60, „· Karte fehlt“): nur der Name steht getrennt`, alleTeile);
  ck('Kopfzeile: Fehlercodes stehen nie im Namensteil (kein Kürzen des Codes durch die Anzeige)',
    kopfZeile({ rolle: 'slave', zustand: 'fehler', code: 'sonstig', errCode: 'ECONNRESET', name: LANG, karteFehlt: false }).name === ''
    && kopfZeile({ rolle: 'gesperrt', errCode: 'EISDIR' }).name === '');
  ck('Kopfzeile: rot bekommt nie „· Karte fehlt“ (Text unverändert), grün wird gelb',
    kopfZeile({ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: n, karteFehlt: true }).nach === ' sichtbar, Port gesperrt: Firewall?'
    && kopfZeile({ rolle: 'slave', zustand: 'verbunden', name: n, karteFehlt: true }).farbe === 'gelb');
  ck('Kopfzeile: kopfEingang kürzt den Namen weiter auf 60 Zeichen, vor/nach bleiben unberührt',
    (() => {
      const z = kopfZeile(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, masterName: 'x'.repeat(100), client: { art: 'fehler', code: 'verweigert' } } }));
      return z.name === 'x'.repeat(60) && z.vor === '' && z.nach === ': Master-Modus aus?';
    })());
}

// --- Endprüfung C5: Kopfanzeige/Texte — ein unbekannter IPC-Wert rendert nie undefined oder eine Funktion ----------
{
  const t = toolVerbundText('fehler:constructor', false);
  ck('C5: toolVerbundText „fehler:constructor“ → Text „Fehler (constructor)“, keine Funktion (Object.hasOwn)',
    t !== null && typeof t.text === 'string' && t.text === 'Fehler (constructor)');
  const t2 = toolVerbundText('fehler:toString', false);
  ck('C5: toolVerbundText „fehler:toString“ → Text, keine Funktion', t2 !== null && t2.text === 'Fehler (toString)');
  const basisC: VerbundStand = { rolle: 'slave', rechnerName: 'A', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null, master: null, slave: null };
  const slC = { gekoppelt: true, koppeltGerade: false, masterName: 'Regie-PC', festeAdresse: null, gefundeneMaster: [] };
  const kopfMit = (client: unknown) => kopfanzeige(kopfEingang({ ...basisC, slave: { ...slC, client: client as VerbundClientStand } }));
  const sauber = (k: { text: unknown }): boolean => typeof k.text === 'string' && !k.text.includes('undefined') && !k.text.includes('function');
  let k1: { text: unknown; farbe: string } = { text: '', farbe: '' };
  let k2: { text: unknown; farbe: string } = { text: '', farbe: '' };
  let k3: { text: unknown; farbe: string } = { text: '', farbe: '' };
  let wurf = '';
  try {
    k1 = kopfMit({ art: 'fehler', code: 'constructor' });
    k2 = kopfMit({ art: 'fehler', code: 'kuenftiger-code', errCode: 'E1' });
    k3 = kopfMit({ art: 'fehler', code: 'sonstig', errCode: null });
  } catch (e) {
    wurf = (e as Error).name;
  }
  ck(`C5: Kopf bei code „constructor“ → rot, Text ohne undefined/Funktion (${JSON.stringify(k1.text)})`, wurf === '' && sauber(k1) && k1.farbe === 'rot');
  ck(`C5: Kopf bei code außerhalb der Union → rot, Text ohne undefined (${JSON.stringify(k2.text)})`, wurf === '' && sauber(k2) && k2.farbe === 'rot');
  ck(`C5: errCode null (JSON über IPC) → kein Wurf, „Verbindungsfehler unbekannt“ (${wurf || JSON.stringify(k3.text)})`,
    wurf === '' && k3.text === 'Verbindungsfehler unbekannt');
  let k4: { text: unknown } = { text: '' };
  try {
    k4 = kopfanzeige(kopfEingang({ ...basisC, rolle: 'master', master: { zustand: 'kuenftig' } as unknown as VerbundStand['master'] }));
  } catch (e) {
    wurf = (e as Error).name;
  }
  ck(`C5: unbekannter Master-Zustand → Rückfall statt undefined (${JSON.stringify(k4.text)})`, wurf === '' && sauber(k4));
}

// --- Endprüfung C6: Presence — bye nur bei passender pid, Felder typgeprüft ---------------------------------------
{
  const s = new PresenceStore(() => {});
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello' });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 2, event: 'hello' }); // Zweitinstanz (ohne Einzelinstanz-Sperre)
  s.verarbeite({ appId: 'jm-timer', event: 'beat', pid: 1 });
  s.verarbeite({ appId: 'jm-timer', event: 'bye', pid: 2 }); // die Zweitinstanz beendet sich
  s.verarbeite({ appId: 'jm-timer', event: 'beat', pid: 1 });
  ck('C6: hello1, hello2, beat1, bye2, beat1 → das Tool läuft (bye der anderen pid wirkt nicht)', s.snapshot()[0]?.running === true);
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  ck('C6: bye ohne pid (alter Stand) wirkt weiterhin', s.snapshot()[0]?.running === false);
}
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  let wurf = '';
  try {
    // Reihenfolge wie gemessen: der Eintrag mit Zahl als Name wird beim Sortieren zum linken Vergleichswert → Wurf.
    s.verarbeite({ appId: 'jm-battle', name: 'JM Battle', version: '0.3.0', pid: 4, event: 'hello' });
    s.verarbeite({ appId: 'jm-timer', name: 42 as unknown as string, version: '0.12.0', pid: 1, event: 'hello' });
    s.verarbeite({ appId: 'jm-qa', name: 'JM Q&A', version: 7 as unknown as string, pid: 2, event: 'hello' });
    s.verarbeite({ appId: 99 as unknown as string, name: 'X', version: '1', pid: 3, event: 'hello' });
    s.snapshot();
    s.pruefe(); // 5-s-Sweep
  } catch (e) {
    wurf = (e as Error).name;
  }
  ck(`C6: Beat mit name als Zahl → kein Wurf im Sweep (${wurf || 'ok'})`, wurf === '');
  ck('C6: … Beats mit falschen Typen (name, version, appId) werden verworfen, gültige bleiben',
    JSON.stringify(s.snapshot().map((z) => z.appId)) === JSON.stringify(['jm-battle']));
}

// --- Endprüfung C7: „· Karte fehlt“ ist ein eigener Teil (Anzeige: whitespace-nowrap) --------------------------------
{
  const z1 = kopfZeile({ rolle: 'slave', zustand: 'sucht', name: 'Regie-PC', karteFehlt: true });
  const z2 = kopfZeile({ rolle: 'master', zustand: 'startet', karteFehlt: true });
  ck('C7: Hinweis „· Karte fehlt“ steht getrennt (nicht in vor/nach), der volle Text bleibt gleich',
    (z1 as { hinweis?: string }).hinweis === '· Karte fehlt' && !z1.nach.includes('Karte fehlt')
    && (z2 as { hinweis?: string }).hinweis === '· Karte fehlt' && !z2.vor.includes('Karte fehlt')
    && kopfanzeige({ rolle: 'slave', zustand: 'sucht', name: 'Regie-PC', karteFehlt: true }).text === 'Suche Regie-PC… · Karte fehlt');
  ck('C7: ohne fehlende Karte kein Hinweis', (kopfZeile({ rolle: 'slave', zustand: 'sucht', name: 'Regie-PC', karteFehlt: false }) as { hinweis?: string }).hinweis === '');
}

// --- Endprüfung C1–C4, C7: Regeln des Verbund-Modals (reine Funktionen) und ihre Verdrahtung ----------------------
// Die Komponenten selbst laufen hier nicht (kein DOM): geprüft werden die Regeln als Funktionen und, als Quelltext-
// Prüfung, dass die Komponenten sie auch benutzen.
{
  const quelle = (datei: string): string => readFileSync(new URL(`../src/renderer/src/${datei}`, import.meta.url), 'utf8');
  const fehlerC = (code: VerbundClientStand['code']): VerbundClientStand => ({ art: 'fehler', code, text: 'x' });
  // C1
  ck('C1: „Neue Kennung“ bei ersetzt, signatur und nach Koppel-Ablehnung rechner-id — sonst nicht',
    neueKennungAnbieten(fehlerC('ersetzt'), null) && neueKennungAnbieten(fehlerC('signatur'), null)
    && neueKennungAnbieten({ art: 'aus' }, 'rechner-id') && !neueKennungAnbieten(fehlerC('unbekannt'), null)
    && !neueKennungAnbieten({ art: 'verbunden' }, null) && !neueKennungAnbieten(undefined, 'code-falsch'));
  const slaveQuelle = quelle('components/VerbundSlave.tsx');
  ck('C1: Verdrahtung — das Slave-Modal bietet „Neue Kennung“ über neueKennungAnbieten mit Bestätigung an',
    slaveQuelle.includes('neueKennungAnbieten(') && slaveQuelle.includes('neueKennung()') && slaveQuelle.includes('<Bestaetigung'));
  // C2
  ck('C2: koppelnMoeglich prüft beschaeftigt, Adresse und Code (Enter umgeht nichts)',
    koppelnMoeglich(false, '10.0.0.1', 'K7QXM3PRTH') && !koppelnMoeglich(true, '10.0.0.1', 'K7QXM3PRTH')
    && !koppelnMoeglich(false, ' ', 'K7QXM3PRTH') && !koppelnMoeglich(false, '10.0.0.1', '  '));
  ck('C2: Codefeld leeren nach jedem Versuch, der das Gegenüber erreicht hat (und nach Erfolg)',
    codeFeldLeeren({ ok: true }) && codeFeldLeeren({ ok: false, text: 'x', codeVerbraucht: true })
    && !codeFeldLeeren({ ok: false, text: 'Das Zeichen O kommt im Code nicht vor.' }));
  ck('C2: Verdrahtung — los() nutzt koppelnMoeglich, das Feld wird über codeFeldLeeren geleert',
    /const los = [^\n]*\n\s+if \(!koppelnMoeglich\(/.test(slaveQuelle) && slaveQuelle.includes('codeFeldLeeren('));
  // C3
  const presence = [
    { appId: 'jm-timer', name: 'JM Timer', running: true, verbund: 'verbunden' },
    { appId: 'jm-alt', name: 'Altes Tool', running: true },
    { appId: 'jm-qa', name: 'JM Q&A', running: false, verbund: 'verbunden' },
  ];
  const zm = toolZeilen(presence, false);
  ck('C3: Tools dieses Rechners — laufende Tools mit Zustand, altes Tool „läuft, noch ohne Verbund (Update nötig)“',
    JSON.stringify(zm.map((z) => [z.name, z.text])) === JSON.stringify([['JM Timer', 'mit Master verbunden'], ['Altes Tool', 'läuft, noch ohne Verbund (Update nötig)']]));
  ck('C3: Verdrahtung — auch die Master-Ansicht rendert „Tools dieses Rechners“', quelle('components/VerbundMaster.tsx').includes('<ToolsDiesesRechners'));
  // C4
  ck('C4: speicherFehlerText (Code auf 32 Zeichen gekürzt)', speicherFehlerText('EPERM') === 'Verbund nicht gespeichert (EPERM) — Änderungen gelten nur bis zum Neustart'
    && !speicherFehlerText('E'.repeat(100)).includes('E'.repeat(33)));
  ck('C4: Verdrahtung — das Master-Modal zeigt speicherFehler', quelle('components/VerbundMaster.tsx').includes('speicherFehlerText(m.speicherFehler)'));
  // C7
  const aufrufe: string[] = [];
  const warnungen: string[] = [];
  beimSchliessen({
    schliesseKopplung: async () => { aufrufe.push('schliesseKopplung'); throw Object.assign(new Error('x'), { code: 'EPIPE' }); },
    brecheKoppelnAb: async () => { aufrufe.push('brecheKoppelnAb'); },
    stoppeMasterSuche: async () => { aufrufe.push('stoppeMasterSuche'); },
  }, (e) => warnungen.push(ablehnungText(e, 'anstossen')));
  await new Promise((r) => setTimeout(r, 10));
  ck('C7: beimSchliessen stößt schliesseKopplung IMMER an (unabhängig vom gespeicherten Stand), dazu Abbruch und Suche',
    JSON.stringify(aufrufe) === JSON.stringify(['schliesseKopplung', 'brecheKoppelnAb', 'stoppeMasterSuche']));
  ck('C7: … eine Ablehnung wird gewarnt statt verschluckt', warnungen.length === 1 && warnungen[0]!.includes('EPIPE'));
  const store = readFileSync(new URL('../src/renderer/src/store/verbund.ts', import.meta.url), 'utf8');
  ck('C7: Verdrahtung — schliesse() nutzt beimSchliessen mit console.warn, ohne Bedingung auf den Stand',
    store.includes('beimSchliessen(') && store.includes('console.warn') && !store.includes('stand?.master?.kopplung.offen'));
}

// --- Endprüfung E1: das Handbuch erklärt JEDE Zeile der Tabelle 5.4, im Wortlaut der Kopfanzeige ------------------
{
  const handbuch = readFileSync(new URL('../../../docs/suite-verbund.md', import.meta.url), 'utf8');
  const n = 'Regie-PC';
  const alle: KopfEingang[] = [
    { rolle: 'aus' },
    { rolle: 'gesperrt', errCode: 'EBUSY' },
    { rolle: 'master', zustand: 'startet', karteFehlt: false },
    { rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: false },
    { rolle: 'master', zustand: 'laeuft', n: 2, m: 2, karteFehlt: false },
    { rolle: 'master', zustand: 'laeuft', n: 1, m: 2, karteFehlt: false },
    { rolle: 'master', zustand: 'port-belegt', karteFehlt: false },
    { rolle: 'master', zustand: 'daten-beschaedigt', karteFehlt: false },
    { rolle: 'master', zustand: 'lausch-fehler', errCode: 'EACCES', karteFehlt: false },
    { rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt: false },
    ...(['koppelt', 'sucht', 'verbindet', 'verbunden'] as const).map((zustand) => ({ rolle: 'slave' as const, zustand, name: n, karteFehlt: false })),
    ...(['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'zertifikat', 'uhr', 'protokoll', 'unbekannt', 'signatur', 'ersetzt', 'datei'] as const)
      .map((code) => ({ rolle: 'slave' as const, zustand: 'fehler' as const, code, name: n, karteFehlt: false })),
    { rolle: 'slave', zustand: 'fehler', code: 'sonstig', errCode: 'ECONNRESET', name: n, karteFehlt: false },
  ];
  const fehlend = alle.map((e) => kopfanzeige(e).text).filter((t) => !handbuch.includes(`| ${t} |`));
  ck(`E1: Handbuch „Was die Kopfanzeige sagt“ enthält alle ${alle.length} Zeilen der Tabelle 5.4 wörtlich (fehlend: ${fehlend.join(' · ') || '—'})`,
    fehlend.length === 0);
}

// --- Anhang-Liste des Side-Events-Panels (iveo-Paket, Spec 8.1, 11.3; 12.3 Nr. 8, 9) ----------
// GEMESSEN am Code (#264): Das Panel lud eine Liste nur, wenn noch keine da war (SideEventsPanel.tsx:66), und der
// Aufklapp-Zustand ueberlebte das Schliessen. Jetzt entscheidet anhangListeSchritt, die Anzeige anhangAnzeige.
{
  const ref = (id: string): IveoMaterialRef => ({ id, label: id, kind: 'file', hasAsset: true });
  const ergebnis = (id: string, abgerufen: string, materials?: IveoMaterialRef[], error?: string) =>
    ({ art: 'ergebnis' as const, id, abgerufen, ok: error === undefined, ...(materials ? { materials } : {}), ...(error !== undefined ? { error } : {}) });
  const T0 = new Date(2026, 9, 17, 14, 5).toISOString();
  const T1 = new Date(2026, 9, 17, 14, 6).toISOString();
  const T2 = new Date(2026, 9, 17, 14, 7).toISOString();
  let z = leererAnhangZustand(null);
  z = anhangListeSchritt(z, { art: 'aufklappen', id: 'A' }).zustand;
  z = anhangListeSchritt(z, ergebnis('A', T1, [ref('m1'), ref('m2')])).zustand;
  const auf = anhangListeSchritt(z, { art: 'aufklappen', id: 'A' });
  ck('P7 12.3 Nr. 9: Aufklappen mit schon vorhandener Liste → lädt (laden = id), meldet die Beobachtung [id]',
    auf.laden === 'A' && JSON.stringify(auf.beobachte) === '["A"]' && auf.zustand.listen.A === undefined);
  const zu = anhangListeSchritt(z, { art: 'zuklappen' });
  ck('P7 12.3 Nr. 9: Zuklappen → meldet [], nichts zu laden', JSON.stringify(zu.beobachte) === '[]' && zu.laden === null && zu.zustand.materialsOffen === null);
  const mitFehler = anhangListeSchritt(z, ergebnis('A', T2, undefined, 'Netz weg')).zustand;
  const pz = anhangListeSchritt(mitFehler, { art: 'panelZu' });
  ck('P7 12.3 Nr. 9: panelZu → Listen und Fehler leer, materialsOffen null, meldet []',
    pz.zustand.materialsOffen === null && Object.keys(pz.zustand.listen).length === 0 && Object.keys(pz.zustand.fehler).length === 0
    && JSON.stringify(pz.beobachte) === '[]');
  ck('P7 12.3 Nr. 9: danach Aufklappen → lädt', anhangListeSchritt(pz.zustand, { art: 'aufklappen', id: 'A' }).laden === 'A');
  const ew = anhangListeSchritt(mitFehler, { art: 'eventWechsel' });
  ck('P7 8.1: eventWechsel → wie panelZu (leer, zugeklappt, meldet [])',
    ew.zustand.materialsOffen === null && Object.keys(ew.zustand.listen).length === 0 && JSON.stringify(ew.beobachte) === '[]');
  const alt = anhangListeSchritt(z, ergebnis('A', T0, [ref('m9')]));
  ck('P7 12.3 Nr. 9: Ergebnis mit älterem abgerufen → verworfen', alt.zustand === z && z.listen.A?.length === 2);
  const fremd = anhangListeSchritt(z, ergebnis('B', T2, [ref('m9')]));
  ck('P7 12.3 Nr. 9: Ergebnis für eine nicht beobachtete Liste → verworfen', fremd.zustand === z);
  const okWeg = anhangListeSchritt(mitFehler, ergebnis('A', T2));
  ck('P7 12.3 Nr. 9: ok:true löscht den Fehler, die Zeit rückt vor, die Liste bleibt',
    okWeg.zustand.fehler.A === undefined && okWeg.zustand.abgerufen.A === T2 && okWeg.zustand.listen.A?.length === 2);
  // Fix-Runde 4: ohne begann zählt abgerufen als Beginn. Eigenes Laden (loadMaterials, Task 31): der Zeitpunkt vor seinem Abruf
  // (Task 28); Wächter: die letzte gelungene Prüfung, die der Main kennt, samt eigenem Laden, also nie älter als der Stand hier.
  const spaeterFehler = anhangListeSchritt(z, ergebnis('A', T0, undefined, 'Netz weg'));
  ck('P7 8.1 Fix 4: Fehlschlag ohne begann, abgerufen älter als die gespeicherte Prüfung (überholtes eigenes Laden) → verworfen (L5, kein T14 über einem jüngeren Erfolg)',
    spaeterFehler.zustand === z && anhangAnzeige(spaeterFehler.zustand, 'A', true, 0).fall === 'L5');
  const nurZeit = anhangListeSchritt(auf.zustand, ergebnis('A', T2));
  ck('P7 8.1: ok ohne materials, Liste noch unbekannt → nichts übernommen (der eigene Abruf kann noch kommen)',
    nurZeit.zustand === auf.zustand && anhangListeSchritt(nurZeit.zustand, ergebnis('A', T1, [ref('m1')])).zustand.listen.A?.length === 1);
  // Fix-Runde 1: ein Fehlschlag, der VOR der gespeicherten gelungenen Prüfung begann, ist überholt (überholtes Laden, Wächter-Takt)
  const fehl = (begann?: string) => ({ ...ergebnis('A', T1, undefined, 'Zeitueberschreitung'), ...(begann ? { begann } : {}) });
  const veraltet = anhangListeSchritt(z, fehl(T0));
  ck('P7 8.4 Fix: Fehlschlag, der vor der gespeicherten Prüfung begann → verworfen (kein T14 über einem jüngeren Erfolg)',
    veraltet.zustand === z && anhangAnzeige(veraltet.zustand, 'A', true, 0).fall === 'L5');
  const jung = anhangListeSchritt(z, fehl(T2));
  ck('P7 8.4 Fix: Fehlschlag, der nach der gespeicherten Prüfung begann → übernommen (L3)',
    jung.zustand.fehler.A === 'Zeitueberschreitung' && anhangAnzeige(jung.zustand, 'A', true, 0).fall === 'L3');
  const ohneBeginn = anhangListeSchritt(z, fehl());
  ck('P7 8.4 Fix: Fehlschlag ohne Beginn → wie bisher übernommen', ohneBeginn.zustand.fehler.A === 'Zeitueberschreitung');
  const ohneListe = anhangListeSchritt(auf.zustand, fehl(T0));
  ck('P7 8.4 Fix: Fehlschlag ohne bekannte Liste → übernommen (L2), Beginn ändert nichts', ohneListe.zustand.fehler.A === 'Zeitueberschreitung');
  const juengerOhneBeginn = anhangListeSchritt(z, ergebnis('A', T2, undefined, 'Netz weg'));
  ck('P7 8.1 Fix 4: Fehlschlag ohne begann, abgerufen jünger als die gespeicherte Prüfung → übernommen (L3), der Stand bleibt',
    juengerOhneBeginn.zustand.fehler.A === 'Netz weg' && juengerOhneBeginn.zustand.abgerufen.A === T1 && anhangAnzeige(juengerOhneBeginn.zustand, 'A', true, 0).fall === 'L3');
  const ohneZeit = anhangListeSchritt(z, ergebnis('A', '', undefined, 'Netz weg'));
  ck('P7 8.4 Fix 4: Fehlschlag mit leerem abgerufen (der Main kennt keine gelungene Prüfung, etwa nach zuruecksetzen) → übernommen (L3)',
    ohneZeit.zustand.fehler.A === 'Netz weg' && anhangAnzeige(ohneZeit.zustand, 'A', true, 0).fall === 'L3');
  const beginnZaehlt = anhangListeSchritt(z, { ...ergebnis('A', T0, undefined, 'Netz weg'), begann: T2 });
  ck('P7 8.4 Fix 4: begann geht vor abgerufen (begann nach der gespeicherten Prüfung, abgerufen davor) → übernommen (L3)',
    beginnZaehlt.zustand.fehler.A === 'Netz weg' && anhangAnzeige(beginnZaehlt.zustand, 'A', true, 0).fall === 'L3');
}
{
  // Wechsel des aktiven Side Events im selben Event (12.3 Nr. 9, zweiter Teil)
  const ref = (id: string): IveoMaterialRef => ({ id, label: id, kind: 'file', hasAsset: true });
  const T1 = new Date(2026, 9, 17, 14, 6).toISOString();
  const T2 = new Date(2026, 9, 17, 14, 7).toISOString();
  let z = leererAnhangZustand('A');
  z = anhangListeSchritt(z, { art: 'ergebnis', id: 'A', abgerufen: T1, ok: true, materials: [ref('m1'), ref('m2'), ref('m3')] }).zustand;
  ck('P7 12.3 Nr. 9: aktives A mit Stand, zugeklappt → „📎 3“ (L6)', anhangAnzeige(z, 'A', true, 0).fall === 'L6' && anhangAnzeige(z, 'A', true, 0).zahl === 3);
  const w = anhangListeSchritt(z, { art: 'aktivWechsel', id: 'B' });
  ck('P7 12.3 Nr. 9: aktivWechsel(B) → A ohne Zahl (L7), keine Meldung an den Main',
    anhangAnzeige(w.zustand, 'A', true, 0).fall === 'L7' && anhangAnzeige(w.zustand, 'A', true, 0).zahl === null && w.beobachte === null && w.laden === null);
  const b = anhangListeSchritt(w.zustand, { art: 'ergebnis', id: 'B', abgerufen: T2, ok: true, materials: [ref('m7')] });
  ck('P7 12.3 Nr. 9: erstes Ergebnis für B → übernommen (L6)', anhangAnzeige(b.zustand, 'B', true, 0).fall === 'L6' && anhangAnzeige(b.zustand, 'B', true, 0).zahl === 1);
  const a = anhangListeSchritt(b.zustand, { art: 'ergebnis', id: 'A', abgerufen: T2, ok: true, materials: [ref('m1')] });
  ck('P7 12.3 Nr. 9: danach eintreffendes Ergebnis für A → verworfen', a.zustand === b.zustand);
  let o = anhangListeSchritt(z, { art: 'aufklappen', id: 'A' }).zustand;
  o = anhangListeSchritt(o, { art: 'ergebnis', id: 'A', abgerufen: T1, ok: true, materials: [ref('m1')] }).zustand;
  const wo = anhangListeSchritt(o, { art: 'aktivWechsel', id: null });
  ck('P7 8.1: aktivWechsel(null) bei aufgeklapptem A → A behält Liste (weiter beobachtet, L5)',
    anhangAnzeige(wo.zustand, 'A', true, 0).fall === 'L5' && wo.zustand.aktiv === null);
  const zuB = anhangListeSchritt(anhangListeSchritt(leererAnhangZustand(null), { art: 'aufklappen', id: 'B' }).zustand,
    { art: 'ergebnis', id: 'B', abgerufen: T1, ok: true, materials: [ref('m1')] }).zustand;
  const umA = anhangListeSchritt(zuB, { art: 'aufklappen', id: 'A' }).zustand;
  ck('P7 8.1: Aufklappen von A vergisst die bisher aufgeklappte, nicht aktive Liste B', umA.listen.B === undefined && umA.materialsOffen === 'A');
}
{
  // 12.3 Nr. 8: Kreuzprodukt der Achsen aus 11.3 → genau eine Zeile L0–L7, Text wörtlich je Klasse
  const ref = (id: string): IveoMaterialRef => ({ id, label: id, kind: 'file', hasAsset: true });
  const T = new Date(2026, 9, 17, 14, 5).toISOString();
  type Erster = 'laeuft' | 'gescheitert' | 'gelungen';
  const erwartet = (token: boolean, auf: boolean, aktiv: boolean, stand: boolean, erster: Erster, letzte: 'gelungen' | 'gescheitert', leer: boolean): string => {
    if (!token) return 'L0';
    if (auf && !stand && erster === 'laeuft') return 'L1';
    if (auf && !stand && erster === 'gescheitert') return 'L2';
    if (auf && stand && letzte === 'gescheitert') return 'L3';
    if (auf && stand && leer) return 'L4';
    if (auf && stand) return 'L5';
    if (!auf && aktiv && stand) return 'L6';
    return 'L7';
  };
  const texte: Record<string, (n: number) => string | null> = {
    L0: () => null, L1: () => 'Lade Anhänge…', L2: () => 'Anhänge konnten nicht geladen werden: Netz weg',
    L3: () => 'Stand 14:05 · Aktualisieren gescheitert: Netz weg', L4: () => 'Keine Anhänge an diesem Side Event · Stand 14:05',
    L5: () => 'Stand 14:05', L6: () => null, L7: () => null,
  };
  const klassen = new Map<string, { n: number; gut: number }>();
  for (const token of [true, false]) for (const auf of [true, false]) for (const aktiv of [true, false]) for (const stand of [true, false])
    for (const erster of ['laeuft', 'gescheitert', 'gelungen'] as Erster[]) for (const letzte of ['gelungen', 'gescheitert'] as const) for (const leer of [true, false]) {
      if (!stand && erster === 'gelungen') continue; // ein gelungener erster Abruf hinterlässt immer einen Stand
      const liste = leer ? [] : [ref('m1'), ref('m2')];
      const z: AnhangListenZustand = {
        materialsOffen: auf ? 'X' : null, aktiv: aktiv ? 'X' : 'Y',
        listen: stand ? { X: liste } : {}, abgerufen: stand ? { X: T } : {},
        fehler: (stand ? letzte === 'gescheitert' : erster === 'gescheitert') ? { X: 'Netz weg' } : {},
      };
      const r = anhangAnzeige(z, 'X', token, Date.parse(T));
      const soll = erwartet(token, auf, aktiv, stand, erster, letzte, leer);
      const zahlSoll = ['L3', 'L4', 'L5', 'L6'].includes(soll) ? liste.length : null;
      const gut = r.fall === soll && r.zeile === texte[soll](liste.length) && r.zahl === zahlSoll && r.erneut === (soll === 'L2');
      const k = klassen.get(soll) ?? { n: 0, gut: 0 };
      klassen.set(soll, { n: k.n + 1, gut: k.gut + (gut ? 1 : 0) });
    }
  for (const fall of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']) {
    const k = klassen.get(fall) ?? { n: 0, gut: 0 };
    ck(`P7 12.3 Nr. 8: Kreuz ${fall} (${k.n} Kombinationen) → genau diese Zeile, Text wörtlich, Zahl nur bei bekanntem Stand, „Erneut“ nur in L2`,
      k.n > 0 && k.gut === k.n);
  }
  const ohneText = anhangAnzeige({ materialsOffen: 'X', aktiv: null, listen: {}, abgerufen: {}, fehler: { X: '' } }, 'X', true, 0);
  ck('P7 11.6: T11 ohne Fehlertext', ohneText.fall === 'L2' && ohneText.zeile === 'Anhänge konnten nicht geladen werden.');
  ck('P7 11.6: T19 und „Erneut versuchen“ wörtlich, keine ASCII-Anführungszeichen',
    ANHANG_TEXTE.tooltip === 'Anhänge (Präsentationen, Dateien, Links) anzeigen' && ANHANG_TEXTE.erneut === 'Erneut versuchen'
    && ANHANG_TEXTE.leereListe === 'Keine Anhänge an diesem Side Event'
    && !Object.values(ANHANG_TEXTE).some((t) => (typeof t === 'function' ? (t as (a: string, b: string) => string)('x', 'y') : t).includes('"')));
}

// --- Ordner-Ablage: Kopfzeile und Zeilen im Side-Events-Panel (iveo-Paket, Spec 11.1, 11.2; 12.4 Nr. 28, 30, 42, 46, 49) ---
// Owner-Regel: eine dauerhaft sichtbare Zeile muss in JEDEM Zustand stimmen. Deshalb Kreuzprodukt aller Achsen, die
// Erwartung je Kombination aus der Vorrangkette der Spec, die Texte woertlich (nicht aus ORDNER_ZEILEN_TEXTE gelesen).
{
  const lokal = (h: number, m: number, s = 0, tag = 17): number => new Date(2026, 9, tag, h, m, s).getTime();
  const iso = (ms: number): string => new Date(ms).toISOString();
  const NAME = 'COP31 Tag 1 – Side Events';
  const PFAD = '/Shows/COP31 Tag 1 – Side Events';
  const GEGEN = lokal(14, 4, 30);
  const LEBENSZEICHEN = lokal(13, 58, 10);
  const FORTSCHRITT = lokal(14, 3, 30);
  const VERSUCH = lokal(14, 5, 15); // nächster Versuch in K6 (OFP6), absichtlich nicht die Zeit von „gegen“
  const se = (x: Partial<SideEventOrdnerStand> = {}): SideEventOrdnerStand => ({
    programId: 'P-1', titel: 'Klima', aktiv: false, inMenge: true, ordnerName: 'Klima', pfad: `${PFAD}/Klima`, existiert: true,
    indexFormat: 'eins', anlegbar: null, laedt: null, wartetHinter: null, abruf: 'gelungen', stand: iso(lokal(14, 5)), standAusFrueherSitzung: false,
    fehler: null, n: 3, k: 3, probleme: [], zusaetze: { indexNeuAufgebaut: false, weitererOrdner: null, bedienerGeaendert: 0, gesperrteEndungen: 0 }, ...x,
  });
  const gestoert = [
    se({ programId: 'P-2', abruf: 'gescheitert', fehler: { text: 'iveo antwortet nicht innerhalb von 15 s', seit: iso(lokal(14, 6)) } }),
    se({ programId: 'P-3', anlegbar: { grund: 'Pfad zu lang' } }),
  ];
  const kopfStand = (): AnhangOrdnerStand => ({ showOffen: true, rolle: 'aus', tokenDa: true, schalterAn: true, showDatei: 'da', sperre: null,
    basis: null, runde: null, ersteRundeGestartet: true, naechsteRundeGegen: null, letzterFortschritt: null, sideEvents: [] });

  // 12.4 Nr. 30 Kopf: Show × Rolle × Token × Schalter × Show-Datei × Sperre × Basis × Runde × erste Runde × Uhr × gestört
  type Erwartung = { fall: string; text: string | null; schalter: boolean; ordnerOeffnen: boolean; tooltip: string | null };
  const klassen = new Map<string, { n: number; gut: number }>();
  let kombinationen = 0;
  for (const showOffen of [true, false]) for (const rolle of ['aus', 'master', 'slave'] as const) for (const tokenDa of [true, false])
  for (const schalterAn of [true, false]) for (const showDatei of ['da', 'fehlt', 'nicht-lesbar'] as const)
  for (const sperre of [null, 'fremd', 'namensgleich'] as const) for (const basis of ['existiert', 'fehlt', 'nicht-anlegbar', 'sperre-lesen', 'sperre-schreiben'] as const)
  for (const runde of [false, true]) for (const ersteRunde of [true, false]) for (const uhr of ['frueh', 'spaet'] as const) for (const m of [0, 2]) {
    kombinationen++;
    // Sperrdatei nicht lesbar (Lesefehler außer ENOENT und ENOTDIR) oder nicht schreibbar (lstat): der Ordner ist da (OFP6)
    const existiert = basis === 'existiert' || basis === 'sperre-lesen' || basis === 'sperre-schreiben';
    const fehler = basis === 'nicht-anlegbar' ? { code: 'EACCES', naechsterVersuch: iso(VERSUCH) }
      : basis === 'sperre-lesen' ? { code: 'EACCES', naechsterVersuch: iso(VERSUCH), sperre: 'lesen' as const }
      : basis === 'sperre-schreiben' ? { code: 'EBUSY', naechsterVersuch: iso(VERSUCH), sperre: 'schreiben' as const } : null;
    const stand: AnhangOrdnerStand = {
      showOffen, rolle, tokenDa, schalterAn, showDatei,
      sperre: sperre === null ? null : { art: sperre, rechner: sperre === 'fremd' ? 'TECHNIK-PC' : 'REGIE-PC', lebenszeichen: iso(LEBENSZEICHEN) },
      basis: { name: NAME, pfad: PFAD, existiert, fehler },
      runde: runde ? { i: 2, n: 5 } : null, ersteRundeGestartet: ersteRunde, naechsteRundeGegen: ersteRunde ? iso(GEGEN) : null,
      letzterFortschritt: iso(FORTSCHRITT), sideEvents: m > 0 ? [se(), ...gestoert] : [se()],
    };
    const jetzt = uhr === 'frueh' ? GEGEN + 10_000 : GEGEN + 60_000; // früh: 10 s nach „gegen“, Fortschritt 70 s her; spät: 60 s bzw. 120 s
    const zusatz = m > 0 ? ' · 2 Side Events gestört' : '';
    const tt = PFAD;
    const e: Erwartung =
      !showOffen ? { fall: 'K0', text: null, schalter: false, ordnerOeffnen: false, tooltip: null }
      : rolle === 'slave' ? { fall: 'K1', text: 'Dieser Rechner hat die Rolle „Mit Master verbinden“ und legt keine Anhänge ab.', schalter: false, ordnerOeffnen: false, tooltip: null }
      : !tokenDa ? { fall: 'K2', text: 'Anhänge lädt nur der Launcher mit dem iveo-Token dieser Show.', schalter: false, ordnerOeffnen: false, tooltip: null }
      : !schalterAn ? { fall: 'K3', text: 'Ablage in Side-Event-Ordnern ausgeschaltet.', schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : showDatei !== 'da' ? { fall: 'K4', text: 'Show-Datei am Öffnungspfad nicht gefunden oder nicht lesbar. Ablage pausiert, bis sie wieder da ist.', schalter: true, ordnerOeffnen: false, tooltip: tt }
      : sperre === 'fremd' ? { fall: 'K5', text: 'Ablage liegt bei Rechner „TECHNIK-PC“ (letztes Lebenszeichen 13:58); dieser Rechner legt nichts ab und übernimmt gegen 14:13, wenn kein neues Lebenszeichen kommt.', schalter: true, ordnerOeffnen: true, tooltip: tt }
      : sperre === 'namensgleich' ? { fall: 'K5', text: 'Ablage von einem zweiten Launcher mit demselben Rechnernamen „REGIE-PC“ übernommen (anderer Benutzer an diesem Rechner oder Rechner mit gleichem Namen); dieser Launcher legt nichts ab, bis die Show neu geöffnet wird.', schalter: true, ordnerOeffnen: true, tooltip: tt }
      : basis === 'nicht-anlegbar' ? { fall: 'K6', text: `Ordner „${NAME}“ nicht anlegbar (EACCES). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: false, tooltip: tt }
      : basis === 'sperre-lesen' ? { fall: 'K6', text: `Sperrdatei in „${NAME}“ nicht lesbar (EACCES). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : basis === 'sperre-schreiben' ? { fall: 'K6', text: `Sperrdatei in „${NAME}“ nicht schreibbar (EBUSY). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : runde ? { fall: 'K7', text: (uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich läuft (2 von 5) · kein Fortschritt seit 14:03` : `Ablage: „${NAME}“ · Abgleich läuft (2 von 5)`) + zusatz, schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : !ersteRunde ? { fall: 'K8', text: `Ablage: „${NAME}“ · erster Abgleich folgt`, schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : basis === 'existiert' ? { fall: 'K9', text: (uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich überfällig seit 14:04` : `Ablage: „${NAME}“ · nächster Abgleich gegen 14:04`) + zusatz, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : { fall: 'K10', text: uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich überfällig seit 14:04` : `Ablage: „${NAME}“ · noch nichts abgelegt · nächster Abgleich gegen 14:04`, schalter: true, ordnerOeffnen: false, tooltip: tt };
    const r = kopfzeile(stand, jetzt);
    const k = klassen.get(e.fall) ?? { n: 0, gut: 0 };
    klassen.set(e.fall, { n: k.n + 1, gut: k.gut + (JSON.stringify(r) === JSON.stringify(e) ? 1 : 0) });
  }
  for (const fall of ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10']) {
    const k = klassen.get(fall) ?? { n: 0, gut: 0 };
    ck(`P11 12.4 Nr. 30 Kopf: ${fall} (${k.n} von ${kombinationen} Kombinationen) → genau diese Zeile, Text wörtlich, Schalter und „Ordner öffnen“ nach 11.1`, k.n > 0 && k.gut === k.n);
  }
  ck('P11 12.4 Nr. 30 Kopf: ohne Stand → K0', kopfzeile(null, 0).fall === 'K0' && kopfzeile(null, 0).text === null);

  // 12.4 Nr. 49: K7 ohne Fortschritt mit der Uhr des Renderers
  const k7 = (jetzt: number): string | null => kopfzeile({
    showOffen: true, rolle: 'master', tokenDa: true, schalterAn: true, showDatei: 'da', sperre: null,
    basis: { name: NAME, pfad: PFAD, existiert: true, fehler: null }, runde: { i: 1, n: 3 }, ersteRundeGestartet: true,
    naechsteRundeGegen: iso(GEGEN), letzterFortschritt: iso(FORTSCHRITT), sideEvents: [],
  }, jetzt).text;
  ck('P11 12.4 Nr. 49: 105 s nach letzterFortschritt → T37', k7(FORTSCHRITT + 105_000) === `Ablage: „${NAME}“ · Abgleich läuft (1 von 3)`);
  ck('P11 12.4 Nr. 49: 106 s → T76 mit der Zeit von letzterFortschritt', k7(FORTSCHRITT + 106_000) === `Ablage: „${NAME}“ · Abgleich läuft (1 von 3) · kein Fortschritt seit 14:03`);
  ck('P11 11.1: K9 genau 45 s nach „gegen“ → noch T38, 46 s → T59', (() => {
    const s: AnhangOrdnerStand = { showOffen: true, rolle: 'aus', tokenDa: true, schalterAn: true, showDatei: 'da', sperre: null,
      basis: { name: NAME, pfad: PFAD, existiert: true, fehler: null }, runde: null, ersteRundeGestartet: true,
      naechsteRundeGegen: iso(GEGEN), letzterFortschritt: null, sideEvents: [] };
    return kopfzeile(s, GEGEN + 45_000).text === `Ablage: „${NAME}“ · nächster Abgleich gegen 14:04` && kopfzeile(s, GEGEN + 46_000).text === `Ablage: „${NAME}“ · Abgleich überfällig seit 14:04`;
  })());

  // 12.4 Nr. 30 Zeile: Menge × Ordner × Indexformat × anlegbar × Download × Abruf × Stand × n × k × Wartende/Problem
  const zeilen = new Map<string, { n: number; gut: number }>();
  let zKomb = 0;
  for (const inMenge of [true, false]) for (const existiert of [true, false]) for (const indexFormat of ['eins', 'neuer', 'kaputt', 'fehlt'] as const)
  for (const anlegbar of [false, true]) for (const download of ['laedt-mit', 'laedt-ohne', 'aktiv-wartet', 'nicht-aktiv-wartet', 'sonst'] as const)
  for (const abruf of ['keiner', 'gelungen', 'gescheitert'] as const) for (const standDa of [true, false]) for (const n of [0, 3])
  for (const kGleich of [true, false]) for (const problem of ['keins', 'grund', 'warten'] as const) {
    if (n === 0 && !kGleich) continue;
    zKomb++;
    const k = kGleich ? n : n - 1;
    const probleme: OrdnerProblem[] = problem === 'grund' ? [{ art: 'grund', datei: 'Agenda.pdf', grund: 'zu wenig Speicherplatz (frei 512 MB)' }]
      : problem === 'warten' ? [{ art: 'neue-fassung-wartet', datei: 'Deck.pptx' }] : [];
    const x = se({
      inMenge, existiert, indexFormat, anlegbar: anlegbar ? { grund: 'Pfad zu lang' } : null, n, k, probleme, abruf,
      laedt: download === 'laedt-mit' ? { datei: 'Video.mp4', bytes: 2.5 * 1_048_576, groesse: 10 * 1_048_576 } : download === 'laedt-ohne' ? { datei: 'Video.mp4', bytes: 2.5 * 1_048_576, groesse: null } : null,
      aktiv: download === 'aktiv-wartet', wartetHinter: download === 'aktiv-wartet' || download === 'nicht-aktiv-wartet' ? 'Agenda.pdf' : null,
      stand: standDa ? iso(lokal(14, 5)) : null, standAusFrueherSitzung: standDa && abruf === 'keiner',
      fehler: abruf === 'gescheitert' ? { text: 'iveo antwortet nicht innerhalb von 15 s', seit: iso(lokal(14, 6)) } : null,
    });
    const st = standDa ? '14:05' : '--:--';
    const soll: [string, string, boolean] =
      !inMenge && !existiert ? ['S1', 'Nicht in der Ablage dieser Show, kein Ordner.', false]
      : !inMenge ? ['S2', 'Nicht mehr in der Ablage dieser Show, Ordner bleibt unverändert.', true]
      : indexFormat === 'neuer' ? ['S3', 'Ordner stammt von einem neueren Launcher und wird hier nicht verändert.', true]
      : anlegbar ? ['S4', 'Anhänge: Ordner nicht anlegbar: Pfad zu lang', false]
      : download === 'laedt-mit' ? ['S5', 'Anhänge: lädt „Video.mp4“ (2,5 von 10 MB) …', existiert]
      : download === 'laedt-ohne' ? ['S5', 'Anhänge: lädt „Video.mp4“ (2,5 MB) …', existiert]
      : download === 'aktiv-wartet' ? ['S6', 'Anhänge: wartet auf den laufenden Download „Agenda.pdf“ (anderes Side Event)', existiert]
      : abruf === 'keiner' && indexFormat === 'eins' && standDa ? ['S8', `Anhänge: ${k} im Ordner · Stand ${st} (frühere Sitzung) · Abgleich folgt`, existiert]
      : abruf === 'keiner' ? ['S7', 'Anhänge: noch nicht abgeglichen', existiert]
      : abruf === 'gescheitert' && standDa ? ['S9', `Anhänge: ${k} von ${n} im Ordner · Stand ${st} · Abgleich gestört: iveo antwortet nicht innerhalb von 15 s (seit 14:06)`, existiert]
      : abruf === 'gescheitert' ? ['S10', 'Anhänge: Abgleich gestört: iveo antwortet nicht innerhalb von 15 s (seit 14:06)', existiert]
      : n === 0 && problem !== 'grund' ? ['S11', `Keine Anhänge · Stand ${st}`, existiert]
      : kGleich && problem === 'keins' ? ['S12', `Anhänge: ${n} im Ordner · Stand ${st}`, existiert]
      : ['S13', `Anhänge: ${k} von ${n} im Ordner · Stand ${st}${problem === 'grund' ? ' · Agenda.pdf: zu wenig Speicherplatz (frei 512 MB)' : problem === 'warten' ? ' · Deck.pptx: neue Fassung wartet, Datei ist geöffnet' : ''}`, existiert];
    const r = ordnerZeile(x, lokal(15, 0));
    const zaehltGestoert = ['S4', 'S9', 'S10'].includes(soll[0]) || (soll[0] === 'S13' && problem === 'grund');
    const gut = r.fall === soll[0] && r.text === soll[1] && r.ordnerOeffnen === soll[2] && r.tooltip === `${PFAD}/Klima`
      && gestoerteSideEvents({ ...kopfStand(), sideEvents: [x] }) === (zaehltGestoert ? 1 : 0);
    const z = zeilen.get(soll[0]) ?? { n: 0, gut: 0 };
    zeilen.set(soll[0], { n: z.n + 1, gut: z.gut + (gut ? 1 : 0) });
  }
  for (const fall of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13']) {
    const z = zeilen.get(fall) ?? { n: 0, gut: 0 };
    ck(`P11 12.4 Nr. 30 Zeile: ${fall} (${z.n} von ${zKomb} Kombinationen) → genau diese Zeile, Text wörtlich, „Ordner öffnen“ nach 11.2, gestört nach 9.13`, z.n > 0 && z.gut === z.n);
  }
  ck('P11 11.2: Side Event nicht im Stand → S1', ordnerZeile(undefined, 0).fall === 'S1' && ordnerZeile(undefined, 0).text === 'Nicht in der Ablage dieser Show, kein Ordner.');

  // 12.4 Nr. 28: ein nicht aktives Side Event in der Warteschlange zeigt nie S6
  const wartend = ordnerZeile(se({ aktiv: false, wartetHinter: 'Video.mp4', abruf: 'gescheitert', fehler: { text: 'Agenda in iveo nicht gefunden (404)', seit: iso(lokal(14, 6)) } }), lokal(15, 0));
  ck('P11 12.4 Nr. 28: nicht aktives wartendes Side Event → nie S6, seine Zeile nach S7–S13 (hier T44)',
    wartend.fall === 'S9' && wartend.text === 'Anhänge: 3 von 3 im Ordner · Stand 14:05 · Abgleich gestört: Agenda in iveo nicht gefunden (404) (seit 14:06)');

  // Befund Fix-Runde 1: bei n = 0 verdeckt S11 kein Problem, das kein Warten ist (9.13: jeder Fehler steht in der Zeile)
  const nullIndex = se({ n: 0, k: 0, probleme: [{ art: 'index-nicht-schreibbar', code: 'EIO' }] });
  ck('P11 11.2 Fix 1: n = 0 mit Index-Problem → S13 mit T48 (nicht S11), zählt als gestört',
    ordnerZeile(nullIndex, lokal(15, 0)).fall === 'S13'
    && ordnerZeile(nullIndex, lokal(15, 0)).text === 'Anhänge: 0 von 0 im Ordner · Stand 14:05 · Index nicht schreibbar (EIO)'
    && gestoerteSideEvents({ ...kopfStand(), sideEvents: [nullIndex] }) === 1);
  const nullWartet = se({ n: 0, k: 0, probleme: [{ art: 'ordner-umbenennen-wartet' }] });
  ck('P11 11.2 Fix 1 Gegenprobe: n = 0 mit nur wartendem Problem bleibt S11, nicht gestört',
    ordnerZeile(nullWartet, lokal(15, 0)).fall === 'S11' && gestoerteSideEvents({ ...kopfStand(), sideEvents: [nullWartet] }) === 0);

  // Zusätze und Problem-Formen (11.2)
  const voll = ordnerZeile(se({ zusaetze: { indexNeuAufgebaut: true, weitererOrdner: 'Klima (Kopie)', bedienerGeaendert: 2, gesperrteEndungen: 1 } }), lokal(15, 0));
  ck('P11 11.2: Zusätze T72, T66, T67, T68 in dieser Reihenfolge an der Zeile',
    voll.text === 'Anhänge: 3 im Ordner · Stand 14:05 · Index war beschädigt und ist neu aufgebaut · weiterer Ordner „Klima (Kopie)“ mit derselben Kennung wird nicht gepflegt · 2 vom Bediener geändert · 1 Dateien mit gesperrter Endung umbenannt');
  const mehrere = ordnerZeile(se({ k: 1, probleme: [
    { art: 'grund', datei: 'Zeta.pdf', grund: 'Pfad zu lang' },
    { art: 'grund', datei: 'beta.pdf', grund: 'unvollständig (10 von 20 Bytes)', naechsterVersuch: iso(lokal(14, 10)) },
    { art: 'umbenennen-wartet', datei: 'Alpha.pptx' },
  ] }), lokal(15, 0));
  ck('P11 11.2: erstes Problem nach Dateiname, „ (und ‹m› weitere)“', mehrere.text === 'Anhänge: 1 von 3 im Ordner · Stand 14:05 · Alpha.pptx: Umbenennen wartet, Datei ist geöffnet (und 2 weitere)');
  const versuch = ordnerZeile(se({ k: 2, probleme: [{ art: 'grund', datei: 'beta.pdf', grund: 'unvollständig (10 von 20 Bytes)', naechsterVersuch: iso(lokal(14, 10)) }] }), lokal(15, 0));
  ck('P11 11.2: Rückhaltung „‹Datei›: ‹Grund› · nächster Versuch gegen ‹hh:mm›“', versuch.text === 'Anhänge: 2 von 3 im Ordner · Stand 14:05 · beta.pdf: unvollständig (10 von 20 Bytes) · nächster Versuch gegen 14:10');
  const ohneDatei = ordnerZeile(se({ probleme: [{ art: 'grund', datei: 'Agenda.pdf', grund: 'Pfad zu lang' }, { art: 'index-nicht-schreibbar', code: 'EPERM' }] }), lokal(15, 0));
  ck('P11 11.2: Formen ohne Datei zuerst („Index nicht schreibbar (‹Code›)“)', ohneDatei.text === 'Anhänge: 3 von 3 im Ordner · Stand 14:05 · Index nicht schreibbar (EPERM) (und 1 weitere)');
  ck('P11 11.2: „Ordner-Umbenennen wartet, Inhalt ist geöffnet“',
    ordnerZeile(se({ probleme: [{ art: 'ordner-umbenennen-wartet' }] }), lokal(15, 0)).text === 'Anhänge: 3 von 3 im Ordner · Stand 14:05 · Ordner-Umbenennen wartet, Inhalt ist geöffnet');
  ck('P11 9.13: Wartende zählen nicht als gestört, ein Grund schon',
    gestoerteSideEvents({ ...kopfStand(), sideEvents: [se({ probleme: [{ art: 'umbenennen-wartet', datei: 'a.pdf' }] }), se({ probleme: [{ art: 'index-nicht-schreibbar', code: 'EBUSY' }] })] }) === 1);

  // 12.4 Nr. 46: Stand vom Vortag → „TT.MM. hh:mm“, heute → „hh:mm“
  const gestern = ordnerZeile(se({ abruf: 'keiner', stand: iso(lokal(14, 5, 0, 16)), standAusFrueherSitzung: true, k: 2 }), lokal(9, 0));
  ck('P11 12.4 Nr. 46: Stand vom Vortag → S8 mit „16.10. 14:05“', gestern.fall === 'S8' && gestern.text === 'Anhänge: 2 im Ordner · Stand 16.10. 14:05 (frühere Sitzung) · Abgleich folgt');
  ck('P11 12.4 Nr. 46: nach dem ersten Abruf S12 mit Uhrzeit', ordnerZeile(se({ stand: iso(lokal(9, 1)) }), lokal(9, 2)).text === 'Anhänge: 3 im Ordner · Stand 09:01');

  // 12.4 Nr. 42 (Block): Side Events der Menge, die die Panel-Liste nicht zeigt
  const blockStand: AnhangOrdnerStand = { ...kopfStand(), sideEvents: [se({ programId: 'A' }), se({ programId: 'B' }), se({ programId: 'C', inMenge: false })] };
  ck('P11 12.4 Nr. 42 Block: Side Event der Menge, das die Panel-Liste nicht zeigt → im Block (nicht das außerhalb der Menge)',
    weitereSideEvents(blockStand, ['A']).map((x) => x.programId).join(',') === 'B');
  ck('P11 12.4 Nr. 42 Block: ohne Panel-Liste (kein Cache) → alle der Menge', weitereSideEvents(blockStand, []).map((x) => x.programId).join(',') === 'A,B');

  const T = ORDNER_ZEILEN_TEXTE;
  ck('P11 11.6: T26, T30, T52, T65 wörtlich', T.schalter === 'Anhänge in Side-Event-Ordnern ablegen' && T.ordnerOeffnen === 'Ordner öffnen'
    && T.keineShow === 'Anhänge werden erst mit einer geöffneten Show-Datei in Ordnern neben ihr abgelegt.' && T.weitere === 'Weitere Side Events der Ablage');
  const alle = Object.values(T).map((t) => (typeof t === 'function' ? (t as (...a: unknown[]) => string)('x', 1, 2, 'y', 'z') : t));
  ck('P11 11.6: keine ASCII-Anführungszeichen und kein „spätestens“ in den Texten', alle.every((t) => !t.includes('"') && !t.includes('spätestens')));
}

// --- iveo-Paket, Block E: Verdrahtung von Electron-Dateien, Store und Panel (Quelltext-Wächter, EP13) ---------------
// Diese Dateien laden Electron bzw. React und laufen hier nicht; geprüft wird ihr Quelltext (Muster C1–C7, M1/M2 oben).
// Der Worktree unter Windows hat CRLF, die CI LF: verglichen wird nach LF.
function quelleLf(pfad: string): string {
  return readFileSync(new URL(pfad, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}
/** Körper einer Funktion: ab `kopf` bis zur ersten Zeile, die in der Einrückung der Kopfzeile mit `}` beginnt. */
function funktionsKoerper(quelle: string, kopf: string): string {
  const i = quelle.indexOf(kopf);
  if (i < 0) return '';
  const einzug = /^ */.exec(quelle.slice(quelle.lastIndexOf('\n', i) + 1, i))?.[0] ?? '';
  const ende = quelle.slice(i).search(new RegExp(`\n${einzug}\}`));
  return ende < 0 ? '' : quelle.slice(i, i + ende + 1 + einzug.length + 1);
}

// --- iveo-Paket P25 (Spec 7.2, E15): Einstellungen zeigen die eingetragene Adresse --------------------------------
{
  const modal = quelleLf('../src/renderer/src/components/SettingsModal.tsx');
  const einst = quelleLf('../src/main/settings.ts');
  const typen = quelleLf('../src/shared/types.ts');
  const T5 = 'iveo-Eventplattform (#11): Basis-URL der API. Leer = Standard (Production). Das Token ist pro Event und wird beim Anlegen einer Show eingetragen — es liegt verschlüsselt hier und nie in der Show-Datei.';
  const T6 = 'https://app.my-iveo.de/api/v1';
  const T9_ANFANG = 'Standard für neue Bindungen und Shows ohne Adresse: ';
  const iEffekt = modal.indexOf("  useEffect(() => {\n    if (open) setIveoBaseUrl(settings?.iveoBaseUrlEingetragen ?? '');\n  }, [open, settings]);");
  const iReturn = modal.indexOf('  if (!open) return null;');
  ck('P25 7.2: SettingsModal füllt das Feld bei jedem Öffnen mit iveoBaseUrlEingetragen (useEffect auf open, vor dem frühen return)',
    iEffekt > 0 && iReturn > 0 && iEffekt < iReturn);
  ck('P25 7.2: … das Feld startet nicht mehr mit der wirksamen Adresse (kein useState(settings?.iveoBaseUrl …))',
    modal.includes("const [iveoBaseUrl, setIveoBaseUrl] = useState('');") && !modal.includes('useState(settings?.iveoBaseUrl'));
  ck('P25 T5: Hinweis wörtlich als Konstante, im Modal gezeigt',
    modal.includes(`const TEXT_IVEO_HINWEIS =\n  '${T5}';`) && modal.includes('>{TEXT_IVEO_HINWEIS}</p>'));
  ck('P25 T6: Platzhalter wörtlich als Konstante, am Feld',
    modal.includes(`const TEXT_IVEO_PLATZHALTER = '${T6}';`) && modal.includes('placeholder={TEXT_IVEO_PLATZHALTER}'));
  ck('P25 T9: Zeile unter dem Feld wörtlich, mit der Adresse aus settings.iveoBaseUrl',
    modal.includes(`  return \`${T9_ANFANG}\${url}\`;`) && modal.includes('{textIveoStandard(settings.iveoBaseUrl)}'));
  ck('P25 7.1: kein „Staging“ mehr im Einstellungsfenster', !/staging/i.test(modal));
  ck('P25 T5, T6, T9: keine ASCII-Anführungszeichen in den Texten', ![T5, T6, T9_ANFANG].some((t) => t.includes('"')));
  ck('P25 7.2: getSettingsView liefert den gespeicherten Wert (read().iveoBaseUrl), nicht den wirksamen',
    funktionsKoerper(einst, 'export function getSettingsView(): SuiteSettingsView {').includes('    iveoBaseUrlEingetragen: read().iveoBaseUrl ?? null,'));
  ck('P25 7.2: SuiteSettingsView trägt iveoBaseUrlEingetragen: string | null; Kommentar „leer = Standard (Production)“',
    typen.includes('  iveoBaseUrlEingetragen: string | null;') && typen.includes('leer = Standard (Production)') && !typen.includes('Staging-Default'));
  ck('P25 7.1: Kommentare in settings.ts nennen Production, nicht mehr Staging', !/staging/i.test(einst) && einst.includes('Default = Production'));
}

// --- Release-Liste: alle Seiten lesen ----------------------------------------
// GEMESSEN am 01.10.2026: 187 Releases, gelesen wurde nur Seite 1. copy,
// grafiktool und media-converter waren darum nicht installierbar.
await (async () => {
  const voll = (n: number) => Array.from({ length: 100 }, (_, i) => `s${n}-${i}`);

  let abrufe: number[] = [];
  let r = await holeAlleSeiten(async (s) => { abrufe.push(s); return s === 1 ? voll(1) : ['copy-v0.3.0']; });
  ck('R1: Eintrag auf Seite 2 ist dabei', r.includes('copy-v0.3.0') && r.length === 101);
  ck('R1: nach der kurzen Seite 2 kein weiterer Abruf', abrufe.join(',') === '1,2');

  abrufe = [];
  r = await holeAlleSeiten(async (s) => { abrufe.push(s); return s === 1 ? [] : voll(s); });
  ck('R2: leere erste Seite → leere Liste, ein Abruf', r.length === 0 && abrufe.join(',') === '1');

  abrufe = [];
  r = await holeAlleSeiten(async (s) => { abrufe.push(s); return voll(s); });
  ck(`R3: lauter volle Seiten → Obergrenze ${RELEASES_MAX_SEITEN}, keine Endlosschleife`,
    abrufe.length === RELEASES_MAX_SEITEN && r.length === RELEASES_MAX_SEITEN * 100);

  let geworfen = '';
  try {
    await holeAlleSeiten(async (s) => { if (s === 2) throw new Error('GitHub API 500'); return voll(s); });
  } catch (e) { geworfen = (e as Error).message; }
  ck('R4: Fehler auf einer Folgeseite wird geworfen, keine halbe Liste', geworfen === 'GitHub API 500');

  let keinArray = '';
  try {
    await holeAlleSeiten(async () => ({ message: 'Bad credentials' }) as unknown as string[]);
  } catch (e) { keinArray = (e as Error).message; }
  ck('R5: eine Antwort, die keine Liste ist, wird als Fehler gemeldet', keinArray.includes('kein Array'));
})();

// --- Show-Editor 0.13.1: Meldung sichtbar, „Trotzdem speichern“ (Verdrahtung, Quelltext-Prüfung wie oben) ----------
// Die Regeln selbst (speichernAbgelehnt mit trotzdem, formularSchluessel, Text) prüft test/show-speichern.test.ts.
{
  const quelle = (datei: string): string => readFileSync(new URL(`../src/renderer/src/${datei}`, import.meta.url), 'utf8');
  const zWert = (klasse: string): number => Number(klasse.replace(/^z-\[?/, '').replace(/\]$/, ''));
  // M1: Die Meldung (notice) lag ohne z-index hinter dem Show-Editor (fixed inset-0 z-50).
  const overlays: Array<[string, number]> = [];
  for (const datei of readdirSync(new URL('../src/renderer/src/components/', import.meta.url))) {
    if (!datei.endsWith('.tsx')) continue;
    for (const m of quelle(`components/${datei}`).matchAll(/fixed inset-0\b[^"]*?\b(z-\[\d+\]|z-\d+)/g)) overlays.push([datei, zWert(m[1])]);
  }
  const toast = /\{notice && \(\s*<div className="([^"]*)"/.exec(quelle('App.tsx'))?.[1] ?? '';
  const toastZ = /(?:^|\s)(z-\[\d+\]|z-\d+)(?=\s|$)/.exec(toast)?.[1];
  const hoechstes = Math.max(...overlays.map(([, z]) => z));
  ck(`M1: alle Vollbild-Overlays haben einen z-Wert (${overlays.length} gefunden, höchster ${hoechstes})`,
    overlays.length >= 10 && Number.isFinite(hoechstes));
  ck('M1: die Meldung liegt über JEDEM Overlay des Launchers', toastZ !== undefined && zWert(toastZ) > hoechstes);
  ck('M1: … und ihre Ebene fängt weiter keine Klicks (pointer-events-none)', toast.includes('pointer-events-none'));
  // M1b/M2: Ablehnung inline bei den Knöpfen, „Trotzdem speichern“ nur für den abgelehnten Stand.
  const editor = quelle('components/ShowEditorModal.tsx');
  ck('M2: onSave reicht trotzdem an speichernAbgelehnt durch',
    editor.includes('speichernAbgelehnt(editPath ? geladen : null, f, aktuelleDatei, trotzdem)'));
  ck('M2: der Knopf „Trotzdem speichern“ ruft onSave(true) und trägt die Beschriftung aus show-speichern.ts',
    /onClick=\{\(\) => void onSave\(true\)\}>\s*\{KNOPF_TROTZDEM_SPEICHERN\}/.test(editor));
  ck('M2: der Speichern-Knopf beim Bearbeiten trägt KNOPF_AKTUALISIEREN (die Meldung nennt ihn)',
    editor.includes("editPath ? KNOPF_AKTUALISIEREN : 'Speichern'"));
  ck('M2: das Angebot gilt nur ohne laufendes Speichern und für genau den abgelehnten Formularstand',
    /ablehnung && !busy && ablehnung\.schluessel === formularSchluessel\(editPath, formular\(\)\)/.test(editor));
  const resetForm = /const resetForm = \(\): void => \{([\s\S]*?)\n {2}\};/.exec(editor)?.[1] ?? '';
  ck('M2: resetForm (Abbrechen, Bestehende öffnen, nach dem Speichern) räumt die Ablehnung weg', resetForm.includes('setAblehnung(null)'));
  ck('M2: ein neuer Speicherversuch räumt die alte Ablehnung zuerst weg',
    /const onSave = async \(trotzdem = false\): Promise<void> => \{\s*setBusy\(true\);[^]*?setAblehnung\(null\);\s*try \{/.test(editor));
  // Schlussprüfung (GEMESSEN 02.10.2026, Electron + Build-CSS): Derselbe Text stand zusätzlich als Meldung unten und
  // überdeckte die Inline-Meldung samt „Trotzdem speichern“ 4 s lang. Die Ablehnung steht nur inline über den Knöpfen.
  const ablehnZweig = /if \(abgelehnt\) \{([\s\S]*?)\n {6}\}/.exec(editor)?.[1] ?? '';
  ck('M1b: die Ablehnung steht nur inline, keine zusätzliche Meldung, die sie überdeckt',
    ablehnZweig.includes('setAblehnung({') && !ablehnZweig.includes('setNotice('));
  // Nachbesserung (Prüfer, GEMESSEN 02.10.2026 in Electron mit dem Build-CSS): Die innere Box der Meldung war weiter
  // pointer-events-auto. Seit sie über den Dialogen liegt, fing sie 4 s lang Klicks auf „Trotzdem speichern“,
  // „Aktualisieren“ und „Abbrechen“ ab (elementFromPoint = Toast). Sie enthält nur Text — keine Ebene fängt Klicks.
  const toastBlock = /\{notice && \(([\s\S]*?)\n {6}\)\}/.exec(quelle('App.tsx'))?.[1] ?? '';
  const toastInnen = /<div className="[^"]*">\s*<div\s+className="([^"]*)"/.exec(toastBlock)?.[1] ?? '';
  ck('M1: … auch die innere Box der Meldung fängt keine Klicks (sie liegt über den Knöpfen der Dialoge)',
    toastInnen.includes('pointer-events-none') && toastBlock.length > 0 && !toastBlock.includes('pointer-events-auto'));
  // Nachbesserung (Prüfer, GEMESSEN): Die Inline-Meldung (~150 px) stand UNTER dem fest 68vh hohen Scrollbereich. Die Karte
  // wurde höher als das Fenster, das Overlay scrollt nicht → bei 821 px Innenhöhe (Standardfenster) lagen „Aktualisieren“
  // und „Abbrechen“ zum größten Teil, bei 601–790 px ganz außerhalb. Jetzt wie #233 (SystemStatusModal): eigener
  // flex-col-Container höchstens fensterhoch, nur der Scrollbereich schrumpft, Meldung und Fußzeile nicht.
  const karte = /<Card className="[^"]*">([\s\S]*?)<\/Card>/.exec(editor)?.[1] ?? '';
  const iHuelle = karte.indexOf('<div className="flex max-h-[calc(100vh-6rem)] flex-col">');
  const scrollKlasse = /<div className="([^"]*\boverflow-y-auto\b[^"]*)">/.exec(karte);
  const iScroll = scrollKlasse?.index ?? -1;
  const iAlert = karte.search(/role="alert"\s+className="[^"]*\bshrink-0\b/);
  const iFuss = karte.search(/<div className="[^"]*\bshrink-0\b[^"]*\bborder-t\b/);
  ck('Layout: der Show-Editor ist höchstens fensterhoch (eigener flex-col-Container in der Card, wie #233)',
    iHuelle >= 0 && iHuelle < iScroll);
  ck('Layout: … nur der Scrollbereich schrumpft (min-h-0, nicht shrink-0)',
    !!scrollKlasse && /\bmin-h-0\b/.test(scrollKlasse[1]) && !/\bshrink-0\b/.test(scrollKlasse[1]));
  ck('Layout: … Inline-Meldung und Fußzeile folgen im selben Container und schrumpfen nicht (shrink-0)',
    iScroll < iAlert && iAlert < iFuss);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
