// Selbsttest der reinen Launcher-Helfer - ohne Electron, ohne Fenster:
//   node --experimental-strip-types test/selftest.ts
import { startShowTools } from '../src/main/show-launch.ts';
import { PresenceStore, gueltigerVerbund } from '../src/main/presence-store.ts';
import { kopfanzeige, kopfEingang, kopfText, kopfZeile, type KopfEingang } from '../src/renderer/src/lib/kopfanzeige.ts';
import { readFileSync } from 'node:fs';
import { beimSchliessen } from '../src/renderer/src/lib/verbund-schliessen.ts';
import {
  ablehnungText, codeFeldLeeren, koppelnMoeglich, neueKennungAnbieten, speicherFehlerText, toolVerbundText, toolZeilen, zeigeCode,
} from '../src/renderer/src/lib/verbund-texte.ts';
import type { VerbundClientStand, VerbundStand } from '../src/shared/types.ts';

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

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
