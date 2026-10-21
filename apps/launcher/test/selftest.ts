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
import { gestoerteSideEvents, kopfSichtbar, kopfzeile, listenZeile, ORDNER_ZEILEN_TEXTE, ordnerZeile, weitereSideEvents } from '../src/renderer/src/lib/ordner-zeilen.ts';
import type { AnhangOrdnerStand, OrdnerProblem, SideEventOrdnerStand } from '../src/shared/types.ts';
import {
  compareVersions, keinPaketText, proxyAntwortAuswerten, proxyFehlerText, waehleRelease, type ProxyAntwortLike, type ReleaseEintrag,
} from '../src/main/release-wahl.ts';
import {
  anleitungSchritt, beimStart, geltendeSchritte, kapitelZustand, leererFortschritt, pruefeAnleitung, sprechTexte, ZIEL_MUSTER,
  type AnleitungsFortschritt, type AnleitungsSchritt, type Bedingung,
} from '@jm/ui/anleitung';
import {
  ANLEITUNG_SCHLUESSEL, EINRICHTUNG, LAUNCHER_ANLEITUNG_TEXTE, STIMME_SCHLUESSEL, ZIEL_KENNUNGEN,
} from '../src/renderer/src/anleitung/einrichtung.ts';
import {
  anleitungsZustand, ENTSCHEIDUNGS_NAMEN, EREIGNIS_NAMEN, kapitelDetails, neueToolEreignisse, produktionLaeuft, ZUSTANDS_NAMEN,
  type AnleitungsEingang,
} from '../src/renderer/src/lib/anleitung-zustand.ts';
import { leseFortschritt, schreibeFortschritt } from '@jm/ui/anleitung';
import {
  anleitungsEingang, erzeugeAnleitungsTreiber, PRESENCE_FRIST_MS, type LauncherLage, type TreiberStand,
} from '../src/renderer/src/lib/anleitung-zustand.ts';
import { startEntscheidung, type StartEingang } from '../src/renderer/src/lib/anleitung-zustand.ts';
import { anleitungAnsicht } from '@jm/ui/anleitung';
import { anleitungsUmgebung, launcherBlase } from '../src/renderer/src/lib/anleitung-zustand.ts';
import { ersteSchritteKnopf } from '../src/renderer/src/lib/anleitung-zustand.ts';
import { ANLEITUNG_TEXTE as U_TEXTE } from '../../../packages/ui/src/lib/texte.ts';
import { LAUNCHER_ANLEITUNG_TEXTE as L_TEXTE } from '../src/renderer/src/anleitung/einrichtung.ts';
import { SCENARIOS as SZENARIEN } from '../src/renderer/src/lib/scenarios.ts';
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
  let leererName = 0;
  let oeffnenOhneBasis = 0;
  // Restpunkt P1 (G8): Das Panel zeigt den Kopf, sobald Text, Schalter oder „Ordner öffnen“ etwas zu zeigen hat. Ohne
  // bekannten Basisordner (K7, K8, K10) gibt es keinen Text, der Schalter T26 bleibt aber versprochen und muss sichtbar sein.
  let schalterOhneText = 0;
  let kopfVerdeckt = 0;
  // Gesamtprüfung Befund 2: Achse „Basisordner unbekannt“ (basis null). Ohne Namen gibt es T37–T39, T58, T59, T76 nicht: keine
  // Zeile statt „Ablage: „“ …“, „Ordner öffnen“ nur mit bekanntem Basisordner. Der Lauf setzt ihn ab dem Öffnen ohne Dateizugriff.
  for (const showOffen of [true, false]) for (const rolle of ['aus', 'master', 'slave'] as const) for (const tokenDa of [true, false])
  for (const schalterAn of [true, false]) for (const showDatei of ['da', 'fehlt', 'nicht-lesbar'] as const)
  for (const sperre of [null, 'fremd', 'namensgleich'] as const) for (const basis of ['existiert', 'fehlt', 'nicht-anlegbar', 'sperre-lesen', 'sperre-schreiben', 'unbekannt'] as const)
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
      basis: basis === 'unbekannt' ? null : { name: NAME, pfad: PFAD, existiert, fehler },
      runde: runde ? { i: 2, n: 5 } : null, ersteRundeGestartet: ersteRunde, naechsteRundeGegen: ersteRunde ? iso(GEGEN) : null,
      letzterFortschritt: iso(FORTSCHRITT), sideEvents: m > 0 ? [se(), ...gestoert] : [se()],
    };
    const jetzt = uhr === 'frueh' ? GEGEN + 10_000 : GEGEN + 60_000; // früh: 10 s nach „gegen“, Fortschritt 70 s her; spät: 60 s bzw. 120 s
    const zusatz = m > 0 ? ' · 2 Side Events gestört' : '';
    const ohne = basis === 'unbekannt';
    const tt = ohne ? null : PFAD;
    const e: Erwartung =
      !showOffen ? { fall: 'K0', text: null, schalter: false, ordnerOeffnen: false, tooltip: null }
      : rolle === 'slave' ? { fall: 'K1', text: 'Dieser Rechner hat die Rolle „Mit Master verbinden“ und legt keine Anhänge ab.', schalter: false, ordnerOeffnen: false, tooltip: null }
      : !tokenDa ? { fall: 'K2', text: 'Anhänge lädt nur der Launcher mit dem iveo-Token dieser Show.', schalter: false, ordnerOeffnen: false, tooltip: null }
      : !schalterAn ? { fall: 'K3', text: 'Ablage in Side-Event-Ordnern ausgeschaltet.', schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : showDatei !== 'da' ? { fall: 'K4', text: 'Show-Datei am Öffnungspfad nicht gefunden oder nicht lesbar. Ablage pausiert, bis sie wieder da ist.', schalter: true, ordnerOeffnen: false, tooltip: tt }
      : sperre === 'fremd' ? { fall: 'K5', text: 'Ablage liegt bei Rechner „TECHNIK-PC“ (letztes Lebenszeichen 13:58); dieser Rechner legt nichts ab und übernimmt gegen 14:13, wenn kein neues Lebenszeichen kommt.', schalter: true, ordnerOeffnen: !ohne, tooltip: tt }
      : sperre === 'namensgleich' ? { fall: 'K5', text: 'Ablage von einem zweiten Launcher mit demselben Rechnernamen „REGIE-PC“ übernommen (anderer Benutzer an diesem Rechner oder Rechner mit gleichem Namen); dieser Launcher legt nichts ab, bis die Show neu geöffnet wird.', schalter: true, ordnerOeffnen: !ohne, tooltip: tt }
      : basis === 'nicht-anlegbar' ? { fall: 'K6', text: `Ordner „${NAME}“ nicht anlegbar (EACCES). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: false, tooltip: tt }
      : basis === 'sperre-lesen' ? { fall: 'K6', text: `Sperrdatei in „${NAME}“ nicht lesbar (EACCES). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : basis === 'sperre-schreiben' ? { fall: 'K6', text: `Sperrdatei in „${NAME}“ nicht schreibbar (EBUSY). Nächster Versuch gegen 14:05.`, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : runde ? { fall: 'K7', text: ohne ? null : (uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich läuft (2 von 5) · kein Fortschritt seit 14:03` : `Ablage: „${NAME}“ · Abgleich läuft (2 von 5)`) + zusatz, schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : !ersteRunde ? { fall: 'K8', text: ohne ? null : `Ablage: „${NAME}“ · erster Abgleich folgt`, schalter: true, ordnerOeffnen: existiert, tooltip: tt }
      : basis === 'existiert' ? { fall: 'K9', text: (uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich überfällig seit 14:04` : `Ablage: „${NAME}“ · nächster Abgleich gegen 14:04`) + zusatz, schalter: true, ordnerOeffnen: true, tooltip: tt }
      : { fall: 'K10', text: ohne ? null : uhr === 'spaet' ? `Ablage: „${NAME}“ · Abgleich überfällig seit 14:04` : `Ablage: „${NAME}“ · noch nichts abgelegt · nächster Abgleich gegen 14:04`, schalter: true, ordnerOeffnen: false, tooltip: tt };
    const r = kopfzeile(stand, jetzt);
    if (r.text?.includes('„“')) leererName++;
    if (ohne && r.ordnerOeffnen) oeffnenOhneBasis++;
    if (r.text === null && r.schalter) schalterOhneText++;
    if (kopfSichtbar(r) !== (r.text !== null || r.schalter || r.ordnerOeffnen)) kopfVerdeckt++;
    const k = klassen.get(e.fall) ?? { n: 0, gut: 0 };
    klassen.set(e.fall, { n: k.n + 1, gut: k.gut + (JSON.stringify(r) === JSON.stringify(e) ? 1 : 0) });
  }
  for (const fall of ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10']) {
    const k = klassen.get(fall) ?? { n: 0, gut: 0 };
    ck(`P11 12.4 Nr. 30 Kopf: ${fall} (${k.n} von ${kombinationen} Kombinationen) → genau diese Zeile, Text wörtlich, Schalter und „Ordner öffnen“ nach 11.1`, k.n > 0 && k.gut === k.n);
  }
  ck('P11 12.4 Nr. 30 Kopf: ohne Stand → K0', kopfzeile(null, 0).fall === 'K0' && kopfzeile(null, 0).text === null);
  ck(`P11 Gesamt-Fix 11.1: in keiner der ${kombinationen} Kombinationen „Ablage: „“ …“; ohne bekannten Basisordner kein „Ordner öffnen“`,
    leererName === 0 && oeffnenOhneBasis === 0);
  ck(`Restpunkt P1 (G8): Kopf sichtbar genau dann, wenn Text, Schalter oder „Ordner öffnen“ etwas zeigen (${kopfVerdeckt} Abweichungen; ${schalterOhneText} Kombinationen mit Schalter ohne Text)`,
    kopfVerdeckt === 0 && schalterOhneText > 0);

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
  // Restpunkt P4 a (Gesamtprüfung Befund 11): geprüft werden die echten Texte in SettingsModal.tsx, nicht die Kopien dieses
  // Tests; jeder der drei muss dort gefunden werden.
  const echteTexte = [
    /\nconst TEXT_IVEO_HINWEIS =\n {2}'([^'\n]+)';\n/.exec(modal)?.[1],
    /\nconst TEXT_IVEO_PLATZHALTER = '([^'\n]+)';\n/.exec(modal)?.[1],
    /\nfunction textIveoStandard\(url: string\): string \{\n {2}return `([^`\n]+)`;\n/.exec(modal)?.[1],
  ];
  ck('P25 T5, T6, T9: keine ASCII-Anführungszeichen in den Texten (die drei Texte in SettingsModal.tsx)',
    echteTexte.every((t) => typeof t === 'string' && !t.includes('"')));
  ck('P25 7.2: getSettingsView liefert den gespeicherten Wert (read().iveoBaseUrl), nicht den wirksamen',
    funktionsKoerper(einst, 'export function getSettingsView(): SuiteSettingsView {').includes('    iveoBaseUrlEingetragen: read().iveoBaseUrl ?? null,'));
  ck('P25 7.2: SuiteSettingsView trägt iveoBaseUrlEingetragen: string | null; Kommentar „leer = Standard (Production)“',
    typen.includes('  iveoBaseUrlEingetragen: string | null;') && typen.includes('leer = Standard (Production)') && !typen.includes('Staging-Default'));
  ck('P25 7.1: Kommentare in settings.ts nennen Production, nicht mehr Staging', !/staging/i.test(einst) && einst.includes('Default = Production'));
}

// --- iveo-Paket P26 (Spec 7.4, E16, EP1): Binden merkt die Adresse, der Show-Editor zeigt sie beim Bearbeiten --------
{
  const editor = quelleLf('../src/renderer/src/components/ShowEditorModal.tsx');
  const sync = quelleLf('../src/main/iveo-sync.ts');
  const typen = quelleLf('../src/shared/types.ts');
  const binden = funktionsKoerper(sync, 'export async function bindIveoEvent(input: IveoBindInput): Promise<IveoBindResult> {');
  const iNorm = binden.indexOf('    genutzteAdresse = normalizeIveoBaseUrl(baseUrl);');
  const iCatch = binden.indexOf('    return { ok: false, ...toClientError(e) };');
  const iToken = binden.indexOf('getIveoBaseToken(');
  ck('P26 EP1: bindIveoEvent normalisiert die Adresse VOR dem Token-Fallback, in eigenem try mit ok:false über toClientError (T8 auch bei leerem Token-Feld)',
    iNorm > 0 && iCatch > iNorm && iToken > iCatch && binden.includes('getIveoBaseToken(genutzteAdresse)'));
  ck('P26 EP1: die Prüfung „gemerkter Token vorhanden?“ fängt eine Ablehnung bei ungültiger Adresse (kein Absturz, Merker false, Adressfehler gemerkt)',
    /hasIveoBaseToken\(iveoBaseUrl\.trim\(\) \|\| undefined\)[\s\S]*?\.catch\(\(\) => \{\n        if \(cancelled\) return;\n        setIveoBaseTokenSaved\(false\);\n        setIveoAdresseUngueltig\(true\);/.test(editor));
  ck('P26 EP1: beide Wächter (Events laden, Binden) lassen bei ungültiger Adresse an Main durch — Main antwortet mit dem T8-Text, nicht „Token erforderlich“',
    editor.includes('if (!iveoToken.trim() && !iveoBaseTokenSaved && !iveoAdresseUngueltig) {') &&
      editor.includes('if ((!iveoToken.trim() && !iveoBaseTokenSaved && !iveoAdresseUngueltig) || !event) {') &&
      editor.includes('setIveoAdresseUngueltig(false);'));
  ck('P26 EP1: discoverIveoEvents normalisiert die Adresse VOR dem Token-Fallback in eigenem try (T8 auch bei leerem Token-Feld)',
    (() => {
      const k = funktionsKoerper(sync, 'export async function discoverIveoEvents(input: IveoDiscoverInput): Promise<IveoDiscoverResult> {');
      const n = k.indexOf('normalizeIveoBaseUrl(baseUrl)');
      return n > 0 && k.indexOf('getIveoBaseToken(') > n && k.includes('getIveoBaseToken(genutzteAdresse)') && k.indexOf('toClientError(e)') > n && k.indexOf('toClientError(e)') < k.indexOf('getIveoBaseToken(');
    })());
  ck('P26 7.4: … und gibt sie als baseUrl zurück',
    binden.indexOf('      baseUrl: genutzteAdresse,') > binden.indexOf('    return {\n      ok: true,'));
  ck('P26 7.4: normalizeIveoBaseUrl kommt aus @jm/iveo', /import \{[^}]*\n  normalizeIveoBaseUrl,\n[^}]*\} from '@jm\/iveo';/.test(sync));
  ck('P26 7.4: IveoBindResult trägt baseUrl?: string',
    funktionsKoerper(typen, 'export interface IveoBindResult {').includes('\n  baseUrl?: string;'));
  ck('P26 7.4: die neue Bindung trägt bindungsAdresse(res.baseUrl, iveoBaseUrl), nicht nur das Feld',
    editor.includes('        ...bound,\n        baseUrl: bindungsAdresse(res.baseUrl, iveoBaseUrl),'));
  const laden = funktionsKoerper(editor, '  const loadForEdit = async (): Promise<void> => {');
  const iReset = laden.indexOf('    resetForm();');
  ck('P26 7.4: loadForEdit füllt das Feld nach resetForm() mit editorAdresseAusShow(show)',
    iReset > 0 && laden.indexOf('    setIveoBaseUrl(editorAdresseAusShow(show));') > iReset);
  ck('P26 T7: Platzhalter aus basisUrlPlatzhalter(settings?.iveoBaseUrl), kein „Staging“ mehr im Editor',
    editor.includes('placeholder={basisUrlPlatzhalter(settings?.iveoBaseUrl)}') && !/staging/i.test(editor));
  const iSettings = editor.indexOf('  const settings = useTools((s) => s.settings);');
  ck('P26 T7: der Editor liest die Einstellungen aus dem Store, vor dem frühen return',
    iSettings > 0 && iSettings < editor.indexOf('  if (!open) return null;'));
}

// --- iveo-Paket P27 (Spec 5.9, E8, T1): die Meldung nach „Ablauf übernehmen“ baut bindMeldung -----------------------
{
  const editor = quelleLf('../src/renderer/src/components/ShowEditorModal.tsx');
  const binden = funktionsKoerper(editor, '  const bindIveo = async (');
  ck('P27 5.9: bindIveo meldet über bindMeldung mit den Speakern des Bind-Ergebnisses und der Warnung am Ende',
    binden.includes('      setIveoMsg(\n        bindMeldung({') && binden.includes('          speaker: speakers,')
    && binden.includes('          ...(res.warning ? { warnung: res.warning } : {}),'));
  ck('P27 T1: kein eigener Meldungstext mehr im Editor, kein ASCII-Schlusszeichen hinter „${…}',
    binden.length > 0 && !binden.includes('übernommen —') && !/„\$\{[^}]*\}"/.test(editor));
}

// --- iveo-Paket P28 (Spec 8.2, 8.4, 8.6, 6.1): Takt mit Sperre, Anhang-Wächter, meldeAgenda, iveo:watchMaterials ------
{
  const sync = quelleLf('../src/main/iveo-sync.ts');
  const ipc = quelleLf('../src/main/ipc.ts');
  const preload = quelleLf('../src/preload/index.ts');
  const typen = quelleLf('../src/shared/types.ts');
  const t = funktionsKoerper(sync, 'async function takt(): Promise<void> {');
  ck('P28 8.2: der Takt ist async mit Sperre gegen Überholen (zweiter Aufruf kehrt sofort zurück, gelöst im finally)',
    t.includes('  if (taktLaeuft) return;\n  taktLaeuft = true;\n  try {') && /\} finally \{\n {4}taktLaeuft = false;\n {2}\}/.test(t));
  const iKern = t.indexOf('    await kern().abfrage();');
  const iWaechter = t.indexOf('    await anhangWaechter().takt(waechterClient());');
  ck('P28 8.2: erst die Abfrage des Kerns, dann der Anhang-Wächter, nacheinander (await)', iKern > 0 && iWaechter > iKern);
  ck('P28 8.2: der Intervall ruft nur den Takt, nicht mehr kern().abfrage() direkt',
    funktionsKoerper(sync, 'function starteTakt(): void {').includes('  pollTimer = setInterval(() => {\n    void takt();\n  }, POLL_INTERVAL_MS);'));
  const wc = funktionsKoerper(sync, 'function waechterClient(): IveoClient | null {');
  ck('P28 8.2: waechterClient fängt eine ungültige Basis-URL (Konstruktor wirft) und gibt null zurück, der Takt lehnt nie ab',
    wc.includes('  if (!a || !token) return null;\n  try {\n    return iveoClient(token, offeneBaseUrl());\n  } catch {\n    return null; // ungültige Adresse: die Statuszeile des Kerns zeigt sie schon\n  }'));
  const k = funktionsKoerper(sync, 'function kern(): IveoKern {');
  ck('P28 6.1, 8.2: erzeugeKern bekommt taktMs = POLL_INTERVAL_MS und meldeAgenda → Anhang-Wächter',
    k.includes('      taktMs: POLL_INTERVAL_MS,') && k.includes('      meldeAgenda: (programId, e) => agendaAktiv(programId, e),')
    && funktionsKoerper(sync, 'function agendaAktiv(programId: string, e: AgendaErgebnis): void {').includes('  anhangWaechter().agendaVomKern(programId, e);'));
  ck('P28 8.4, 8.6: iveo:watchMaterials prüft die Eingabe mit pruefeBeobachtung und meldet sie dem Wächter',
    ipc.includes("  ipcMain.handle('iveo:watchMaterials', (_e, input: unknown) => watchIveoMaterials(input));")
    && funktionsKoerper(sync, 'export function watchIveoMaterials(input: unknown): void {').includes('  const ids = pruefeBeobachtung(input);\n  if (ids === null) return;\n  anhangWaechter().beobachte(ids);'));
  ck('P28 8.6: Preload watchIveoMaterials ruft genau den Kanal iveo:watchMaterials; JmpsApi kennt ihn',
    preload.includes("  watchIveoMaterials: (input: { programIds: string[] }) => invoke<void>('iveo:watchMaterials', input),")
    && typen.includes('  watchIveoMaterials: (input: { programIds: string[] }) => Promise<void>;'));
  ck('P28 8.2: zuruecksetzen beim Öffnen einer Show, beim Schließen und beim Speichern mit neuer Bindung',
    funktionsKoerper(sync, 'export function onShowOpened(showPath: string, show: Show): void {').includes('  anhangWaechter().zuruecksetzen();')
    && funktionsKoerper(sync, 'export function stopIveoPolling(): void {').includes('  anhangWaechter().zuruecksetzen();')
    && funktionsKoerper(sync, 'export function speichereShowDatei(pfad: string, show: Show, neuGebunden: boolean): boolean {').includes('    if (neuGebunden) anhangWaechter().zuruecksetzen();'));
  const liste = funktionsKoerper(sync, 'export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult> {');
  ck('P28 8.2, 8.6, EP20: listSideEventMaterials bildet über materialienAusAgenda ab, gibt abgerufen mit (auch bei Fehler) und meldet ein gelungenes Laden dem Wächter',
    liste.includes('    const materials = materialienAusAgenda(agenda);')
    && liste.includes('    anhangWaechter().eigenesLaden(programId, abgerufen);\n    return { ok: true, materials, abgerufen };')
    && liste.includes('    return { ok: false, ...toClientError(e), abgerufen };') && !liste.includes('materials.push('));
  ck('P28 T55: Logzeile wörtlich „iveo: Side Event „‹programId›“: ‹n› Anhänge.“, keine „Material(ien)“-Zeile mehr',
    liste.includes('getLog().info(`iveo: Side Event „${programId}“: ${materials.length} Anhänge.`);') && !sync.includes('Material(ien)'));
}

// --- iveo-Paket P29 (Spec 9.2–9.4, 9.13–9.15, E26, E35, E45, E46): Ablage verdrahtet, Schalter, Rolle, Beenden, Ordner-IPC ---
{
  const sync = quelleLf('../src/main/iveo-sync.ts');
  const ipc = quelleLf('../src/main/ipc.ts');
  const preload = quelleLf('../src/preload/index.ts');
  const typen = quelleLf('../src/shared/types.ts');
  const einst = quelleLf('../src/main/settings.ts');
  const verbund = quelleLf('../src/main/verbund/index.ts');
  const haupt = quelleLf('../src/main/index.ts');
  const kanaele: Array<[string, string]> = [
    ["  ipcMain.handle('iveo:anhangOrdner', () => anhangOrdnerStand());", "  anhangOrdnerStand: () => invoke<AnhangOrdnerStand>('iveo:anhangOrdner'),"],
    ["  ipcMain.handle('iveo:setzeAnhangOrdner', (_e, input: unknown) => setzeAnhangOrdner(input));", "  setzeAnhangOrdner: (input: { an: boolean }) => invoke<AnhangOrdnerStand>('iveo:setzeAnhangOrdner', input),"],
    ["  ipcMain.handle('iveo:oeffneAnhangOrdner', (_e, input: unknown) => oeffneAnhangOrdner(input));", "  oeffneAnhangOrdner: (input: { programId?: string }) => invoke<ActionResult>('iveo:oeffneAnhangOrdner', input),"],
  ];
  ck('P29 9.15: drei Ordner-Kanäle im Main und im Preload mit denselben Namen; JmpsApi kennt sie',
    kanaele.every(([m, p]) => ipc.includes(m) && preload.includes(p))
    && typen.includes('  anhangOrdnerStand: () => Promise<AnhangOrdnerStand>;')
    && typen.includes('  setzeAnhangOrdner: (input: { an: boolean }) => Promise<AnhangOrdnerStand>;')
    && typen.includes('  oeffneAnhangOrdner: (input: { programId?: string }) => Promise<ActionResult>;'));
  const oeffnen = funktionsKoerper(sync, 'export async function oeffneAnhangOrdner(input: unknown): Promise<ActionResult> {');
  ck('P29 9.13 (E35): „Ordner öffnen“ nimmt nur die programId und öffnet den Pfad des Laufs mit shell.openPath, Fehler als T31',
    oeffnen.includes('  const pfad = ordner().ordnerPfadFuer(programId);') && oeffnen.includes('  const fehler = await shell.openPath(pfad);')
    && !/input[^\n]*\.(pfad|path)\b/.test(oeffnen) && sync.includes('  return `Ordner nicht zu öffnen: ${grund}`;'));
  const quit = /app\.on\('before-quit', \(\) => \{\n([\s\S]*?)\n {4}\}\);/.exec(haupt)?.[1] ?? '';
  ck('P29 9.2: before-quit stößt das Ende der Ablage an (ablageBeenden() ohne await), der Steuerserver stoppt weiter',
    quit.includes('      ablageBeenden();') && quit.includes('      stopLauncherControlServer();') && !quit.includes('await'));
  ck('P29 9.2: ablageBeenden stößt nur an und baut keinen neuen Lauf',
    funktionsKoerper(sync, 'export function ablageBeenden(): void {').includes('  ordnerInstanz?.beenden();'));
  ck('P29 9.2 Nr. 3: verbundRolle() liest nur kern.rolle()',
    funktionsKoerper(verbund, 'export function verbundRolle(): VerbundRolle {') === 'export function verbundRolle(): VerbundRolle {\n  return kern.rolle();\n}');
  const lauf = funktionsKoerper(sync, 'function ordner(): OrdnerLauf {');
  ck('P29 9.6 (E46): Agenda-Client mit Zeitgrenze (iveoClient), Download-Client ohne (iveoDownloadClient mit fetch)',
    /agendaClient: \(\) => \{\n[^}]*return token \? iveoClient\(token, offeneBaseUrl\(\)\) : null;/.test(lauf)
    && /downloadClient: \(\) => \{\n[^}]*return token \? iveoDownloadClient\(token, offeneBaseUrl\(\), \(url, init\) => fetch\(url, init\)\) : null;/.test(lauf));
  ck('P29 9.2, 9.3, E45: Rolle, Token, Schalter, Tag, Titel, Rechnername, Prozesskennung, Sitzungskennung, Ereignis',
    ['      rolle: () => verbundRolle(),', '      tokenDa: () => tokenDerOffenenShow() !== undefined,', '      schalterAn: () => schalterAn(),',
      '      tagVon: (programId) => tagAusCache(programId),', '      titelVon: (programId) => titelAusCache(programId),',
      '      rechner: hostname(),', '      pid: process.pid,', '      neueSitzungsKennung: () => randomUUID(),',
      "      melde: (stand) => emitIveo?.({ type: 'iveo-anhang-ordner', stand }),"].every((z) => lauf.includes(z)));
  ck('P29 9.2 Nr. 1, 11.1 K0–K2: der Lauf sieht die gebundene offene Show auch ohne Token (ablageShow); Token nur aus kern().aktiv()',
    lauf.includes('      aktiv: () => ablageShow(kern().aktiv(), offeneIveoShow()),')
    && funktionsKoerper(sync, 'function offeneIveoShow(): { path: string; event: string } | null {').includes('  return openShowIveo ? { path: openShowIveo.path, event: openShowIveo.slug } : null;')
    && funktionsKoerper(sync, 'function tokenDerOffenenShow(): string | undefined {').includes('  const a = kern().aktiv();'));
  const neu = ['function tagAusCache(', 'function titelAusCache(', 'function offeneIveoShow(', 'function tokenDerOffenenShow(', 'function schalterAn(',
    'function ordner(', 'export function anhangOrdnerStand(', 'export function setzeAnhangOrdner(',
    'export async function oeffneAnhangOrdner(', 'export function ablageBeenden('];
  ck('P29 G7: der Ordner-Teil der Hülle greift nie synchron aufs Dateisystem; der Lauf bekommt node:fs/promises',
    neu.every((kopf) => { const f = funktionsKoerper(sync, kopf); return f.length > 0 && !/Sync\(|readCache\(/.test(f); })
    && sync.includes("import * as fsp from 'node:fs/promises';") && lauf.includes('      fs: fsp,'));
  ck('P29 9.14: Schalter iveoAnhangOrdner, fehlt er, gilt „an“; „aus“ stößt den Lauf sofort an',
    einst.includes('  iveoAnhangOrdner?: boolean;')
    && funktionsKoerper(einst, 'export function getIveoAnhangOrdner(): boolean {').includes('  return read().iveoAnhangOrdner !== false;')
    && funktionsKoerper(sync, 'export function setzeAnhangOrdner(input: unknown): AnhangOrdnerStand {').includes('    if (!an) ordner().takt();')
    && funktionsKoerper(sync, 'export function setzeAnhangOrdner(input: unknown): AnhangOrdnerStand {').includes('    return ordner().bedingungenNeu();'));
  ck('P29 9.4: neue Sitzung der Ablage beim Öffnen, Schließen und Speichern mit neuer Bindung; der Takt stößt die Ablage an',
    funktionsKoerper(sync, 'export function onShowOpened(showPath: string, show: Show): void {').includes('  ordner().sitzung();')
    && funktionsKoerper(sync, 'export function stopIveoPolling(): void {').includes('  ordner().sitzung();')
    && funktionsKoerper(sync, 'export function speichereShowDatei(pfad: string, show: Show, neuGebunden: boolean): boolean {').includes('    if (neuGebunden) ordner().sitzung();')
    && funktionsKoerper(sync, 'async function takt(): Promise<void> {').includes('    await anhangWaechter().takt(waechterClient());\n    // iveo-Paket, Spec 9.4: die Ablage nur anstoßen; sie arbeitet ihre Warteschlange im Hintergrund ab (E28).\n    ordner().takt();'));
  ck('P29 9.4 (E28): die Hülle wartet nie auf die Ablage: kein ruhig() (nur für Tests) und kein await ordner() in iveo-sync.ts',
    !sync.includes('.ruhig(') && !sync.includes('await ordner()'));
  ck('P29 9.4: die Agenda des aktiven Side Events geht aus meldeAgenda auch an die Ablage',
    funktionsKoerper(sync, 'function agendaAktiv(programId: string, e: AgendaErgebnis): void {').includes('  ordner().agendaAktiv(programId, e);'));
}

// --- iveo-Paket P30 (Spec 8.6, 9.6, E29, E49, E52): manueller Download und Öffnen im Panel ---------------------------
{
  const sync = quelleLf('../src/main/iveo-sync.ts');
  const dl = funktionsKoerper(sync, 'export async function downloadSideEventMaterial(input: IveoDownloadInput): Promise<ActionResult> {');
  ck('P30 8.6: Datenstrom statt fetchAsset/arrayBuffer — oeffneAsset über den Download-Client, ‹Ziel›.‹pid›.jm-laden, dann umbenennen',
    dl.length > 0 && !dl.includes('fetchAsset(') && !dl.includes('arrayBuffer') && !dl.includes('writeFileSync')
    && dl.includes('client: iveoDownloadClient(token, basis, (url, init) => fetch(url, init)), ref, ziel: zwischen, groesse,')
    && dl.includes('    const zwischen = `${ziel}.${process.pid}.jm-laden`;') && dl.includes('await ladeAsset({') && !dl.includes('ladeStromInDatei(')
    && dl.includes('      await fsp.rename(zwischen, ziel);') && dl.includes('      await fsp.unlink(zwischen).catch(() => undefined);'));
  const iPruef = dl.indexOf('      assetAnfrage(ref, basis);');
  const iDialog = dl.indexOf('await dialog.showSaveDialog({ title: TEXT_ANHANG_SPEICHERN, defaultPath: schritt.vorschlag });');
  const iAbruf = dl.indexOf('await ladeAsset({');
  ck('P30 8.6 (E52): Herkunft der Asset-Adresse vor dem Dialog geprüft (T77 b ohne Dialog), Dialog T18 vor dem Abruf',
    iPruef > 0 && iDialog > iPruef && iAbruf > iDialog
    && dl.includes('      if (e instanceof IveoAssetAdresseError) return { ok: false, message: TEXT_ADRESSE_ABGELEHNT };'));
  ck('P30 9.6, 8.6: Leerlauf-Grenze auch vor dem ersten Byte: ein Zeitgeber um oeffneAsset bricht nach 60 s ab und wird danach gelöscht; Leerlauf → T22 (e)',
    dl.includes('groesse, leerlaufMs: ANHANG_LEERLAUF_MS,') && dl.includes("      return { ok: false, message: grundText(e, 'download') };")
    && !dl.includes('setTimeout(() => { leer') && !dl.includes('ORDNER_GRUENDE'));
  const iGross = dl.indexOf('      pruefeAssetGroesse(groesse);');
  ck('P30 9.6 (E29): Größe wie im Ordner: über 2 GiB vor dem Dialog (T22 a), Bytezahl ≠ size_bytes vor dem Umbenennen (T22 f), mehr Daten als die Grenze (T22 b bzw. a)',
    iGross > 0 && iGross < iDialog && iAbruf > iDialog && iAbruf < dl.indexOf('      await fsp.rename(zwischen, ziel);')
    && !sync.includes('ZWEI_GIB') && !dl.includes('ORDNER_GRUENDE') && !dl.includes('geschrieben'));
  ck('P30 8.6 (E49): shell.openPath genau einmal und nur im Zweig panelDateiOeffnen(…), sonst T74',
    (dl.match(/shell\.openPath\(/g) ?? []).length === 1
    && dl.includes('    if (panelDateiOeffnen(name, schritt.gesperrt)) {\n      void shell.openPath(ziel);')
    && dl.includes('    return { ok: true, message: textNichtGeoeffnet(ext, name) };'));
  ck('P30 8.6: Entscheidungen über panelAnhangSchritt; ein Link öffnet nur den geprüften href',
    dl.includes('    const schritt = panelAnhangSchritt(target);') && dl.includes("    if (schritt.art === 'fehler') return { ok: false, message: schritt.text };")
    && dl.includes('      await shell.openExternal(schritt.href);') && !dl.includes('external_url'));
  const texte = [
    "const TEXT_ANHANG_NICHT_DA = 'Anhang nicht mehr in iveo vorhanden.';",
    "const TEXT_ANHANG_SPEICHERN = 'Anhang speichern';",
    "const TEXT_ADRESSE_ABGELEHNT = 'Anhang nicht geladen: Datei-Adresse auf anderem Server ohne https.';",
    '  return `Gespeichert und geöffnet: ${label}`;',
    '  return `Gespeichert, nicht automatisch geöffnet (Endung „${ext}“ gesperrt): ${dateiname}`;',
    '  return `iveo: Anhang „${label}“ gespeichert (${bytes} Bytes) → ${pfad}`;',
  ];
  ck('P30 T16, T18, T20, T56, T74, T77 (b) wörtlich als Konstanten bzw. Textfunktionen (T15, T53, T54 liefert der Helfer)',
    texte.every((z) => sync.includes(z)) && dl.includes('return { ok: false, message: TEXT_ANHANG_NICHT_DA };'));
  ck('P30 E23, EP18: kein „Material“ mehr in Texten der Hülle; MIME_EXT und extFor sind nach side-event-ordner.ts umgezogen',
    !/(['`])[^'`\n]*Material[^'`\n]*\1/.test(sync) && !sync.includes('const MIME_EXT') && !sync.includes('function extFor('));
  ck('P30 G4: Fehlertexte und Logzeilen des Downloads ohne Adressen (ordnerFehlerText, ohneAdressen)',
    dl.includes("      return { ok: false, message: grundText(e, 'download') };")
    && dl.includes('    return { ok: false, message: ohneAdressen(toClientError(e).error) };'));
  // Fix-Runde 1: Token und Basis-URL kommen aus EINEM Moment (der Dialog ist nicht modal, eine andere Show kann sich währenddessen öffnen).
  ck('P30 Fix 1: die Basis-URL wird einmal zu Beginn festgehalten und für Agenda, Herkunftsprüfung und Abruf verwendet (nie erneut offeneBaseUrl())',
    (dl.match(/offeneBaseUrl\(/g) ?? []).length === 1 && dl.includes('  const basis = offeneBaseUrl();')
    && dl.indexOf('  const basis = offeneBaseUrl();') < dl.indexOf('await dialog.showSaveDialog(')
    && dl.includes('iveoClient(token, basis).listAgendaItems(') && dl.includes('assetAnfrage(ref, basis)') && dl.includes('iveoDownloadClient(token, basis,'));
  // Fix-Runde 1: Ordner und Panel laden mit EINEM Baustein (ladeAsset), die 2-GiB-Grenze und die size_bytes-Regel gibt es je einmal.
  const lauf = quelleLf('../src/main/side-event-ordner-lauf.ts');
  const ladeDatei = funktionsKoerper(lauf, "async function ladeDatei(ctx: Ctx, s: Schritt<'laden'>, ziel: string): Promise<number> {");
  ck('P30 Fix 1: die Ablage (ladeDatei) und das Panel rufen beide ladeAsset; der Ladeschritt und die size_bytes-Regel stehen nur dort bzw. in assetGroesse',
    ladeDatei.includes('return await ladeAsset({') && !ladeDatei.includes('ladeStromInDatei(') && !ladeDatei.includes('oeffneAsset(')
    && (lauf.match(/ladeStromInDatei\(/g) ?? []).length === 2 && (lauf.match(/\.oeffneAsset\(/g) ?? []).length === 1
    && (lauf.match(/leer = true/g) ?? []).length === 1 && (lauf.match(/ORDNER_GRUENDE\.unvollstaendig\(/g) ?? []).length === 1
    && !sync.includes('size_bytes === ') && quelleLf('../src/main/iveo-anhaenge.ts').split('Number.isFinite(s) && s >= 0 ? s : null').length === 2);
}

// --- iveo-Paket P31 (Spec 8.1, 8.4, 11.3, E18): Anhang-Liste in Store und Panel nur über die reinen Helfer ------------
{
  const store = quelleLf('../src/renderer/src/store/tools.ts');
  const panel = quelleLf('../src/renderer/src/components/SideEventsPanel.tsx');
  ck('P31 8.1: kein lokaler Aufklapp-Zustand mehr im Panel (openMat); der Zustand liegt im Store',
    !panel.includes('openMat') && store.includes('  anhaenge: AnhangListenZustand;') && store.includes('    anhaenge: leererAnhangZustand(null),'));
  ck('P31 8.1: der Store ruft anhangListeSchritt bei allen sechs Ereignissen',
    store.includes('    const r = anhangListeSchritt(useTools.getState().anhaenge, e);')
    && ["anhangSchritt({ art: 'aufklappen', id: programId })", "anhangSchritt({ art: 'zuklappen' })", "anhangSchritt({ art: 'panelZu' })",
      "anhangSchritt({ art: 'eventWechsel' })", "anhangSchritt({ art: 'aktivWechsel', id: aktiv })",
      "anhangSchritt({ art: 'ergebnis', id: e.programId, abgerufen: e.abgerufen, ok: e.ok, materials: e.materials, error: e.error })"]
      .every((z) => store.includes(z)));
  ck('P31 8.1: Aufklappen lädt immer — keine Bedingung „nur ohne Liste“ (Store), das Panel ruft nur toggleMaterials',
    funktionsKoerper(store, '    toggleMaterials: (programId) => {').includes("      if (useTools.getState().anhaenge.materialsOffen === programId) anhangSchritt({ art: 'zuklappen' });\n      else anhangSchritt({ art: 'aufklappen', id: programId });\n")
    && panel.includes('onClick={() => toggleMaterials(p.id)}') && !panel.includes('loadMaterials'));
  ck('P31 8.1, 8.4: Öffnen meldet [] an den Main (Stand neu senden), Schließen leert und klappt zu',
    funktionsKoerper(store, '    openSideEvents: () => {').includes('void window.jmps.watchIveoMaterials({ programIds: [] })')
    && funktionsKoerper(store, '    closeSideEvents: () => {').includes("anhangSchritt({ art: 'panelZu' })"));
  ck('P31 8.1: Schließen und Event-Wechsel melden dem Main immer [], auch wenn der Helfer nichts meldet',
    store.includes("    const beobachte = r.beobachte ?? (e.art === 'panelZu' || e.art === 'eventWechsel' ? [] : null);"));
  ck('P31 8.1: loadMaterials setzt keine Liste selbst — das Ergebnis geht mit abgerufen an den Helfer',
    funktionsKoerper(store, '    loadMaterials: async (programId) => {').includes("          art: 'ergebnis',\n          id: programId,\n          abgerufen: res.abgerufen ?? new Date().toISOString(),")
    && !store.includes('materials: { ...s.materials'));
  ck('P31 11.3: das Panel zeigt Zahl, Zeile und „Erneut versuchen“ nur nach anhangAnzeige; Tooltip T19 aus ANHANG_TEXTE',
    panel.includes('const anz = anhangAnzeige(anhaenge, p.id, canSwitch, Date.now());') && panel.includes("📎{anz.zahl !== null ? ` ${anz.zahl}` : ''}")
    && panel.includes('title={ANHANG_TEXTE.tooltip}') && panel.includes('{anz.erneut && (') && panel.includes('{anz.zeile}'));
  ck('P31 E23: keine eigenen Texte der Anhang-Liste mehr in Panel und Store (T10–T14, T19 nur aus ANHANG_TEXTE), kein „Material“',
    !['Lade ', 'konnten nicht geladen', 'Keine Anhänge', 'Keine Materialien', 'Aktualisieren gescheitert', 'anzeigen"', 'Materialien']
      .some((t) => panel.includes(t) || store.includes(t)));
}

// --- iveo-Paket P32 (Spec 9.11, 9.13–9.15, 11.1, 11.2): Ordner-Kopfzeile, Zeilen, Block, Schalter, Renderer-Uhr -------
{
  const store = quelleLf('../src/renderer/src/store/tools.ts');
  const panel = quelleLf('../src/renderer/src/components/SideEventsPanel.tsx');
  const iTernaer = panel.indexOf('        {data && !data.ok ? (');
  const iKopf = panel.indexOf('          <OrdnerKopf\n');
  const iEnde = panel.indexOf('        {/* Ende der Side-Event-Liste (data.ok) */}');
  const iBlock = panel.indexOf('        {weitere.length > 0 && (');
  ck('P32 9.13: Kopfzeile unter der Störungszeile und Block „Weitere Side Events der Ablage“ stehen außerhalb des Zweigs data.ok',
    iTernaer > 0 && iKopf > panel.indexOf('{stoerung}') && iKopf < iTernaer && iEnde > iTernaer && iBlock > iEnde);
  ck('P32 9.15: Kopfzeile, Zeilen und Block nach den reinen Helfern, bewertet mit der Uhr des Renderers',
    panel.includes('  const kopf = kopfzeile(anhangOrdner, ordnerUhr);') && panel.includes('listenZeile(anhangOrdner, programId, ordnerUhr)')
    && panel.includes('zeile={ordnerZeile(se, ordnerUhr)}') && panel.includes('weitereSideEvents(anhangOrdner, data?.ok ? programs.map((p) => p.id) : [])'));
  ck('P32 9.15: die Uhr läuft alle 15 s nur bei offenem Panel und wird beim Schließen gelöscht',
    store.includes('const ORDNER_UHR_MS = 15_000;')
    && funktionsKoerper(store, '    openSideEvents: () => {').includes('if (ordnerUhrTimer === null) ordnerUhrTimer = setInterval(() => set({ ordnerUhr: Date.now() }), ORDNER_UHR_MS);')
    && funktionsKoerper(store, '    closeSideEvents: () => {').includes('        clearInterval(ordnerUhrTimer);\n        ordnerUhrTimer = null;')
    && (store.match(/setInterval\(\(\) => set\(\{ ordnerUhr/g) ?? []).length === 1);
  const aufrufe = [...panel.matchAll(/oeffneAnhangOrdner\(([^)]*)\)/g)].map((m) => m[1]);
  ck('P32 9.13 (E35): „Ordner öffnen“ übergibt nur die programId (Zeile, Block) bzw. nichts (Kopfzeile), nie einen Pfad',
    aufrufe.length === 3 && aufrufe.every((a) => ['', 'p.id', 'se.programId'].includes(a))
    && funktionsKoerper(store, '    oeffneAnhangOrdner: async (programId) => {').includes('window.jmps.oeffneAnhangOrdner(programId ? { programId } : {})'));
  ck('P32 9.14 (T26): Schalter nur, wenn kopfzeile ihn erlaubt; gesetzt über den Store',
    panel.includes('          {kopf.schalter && (') && panel.includes('{ORDNER_ZEILEN_TEXTE.schalter}')
    && panel.includes('onSchalter={(an) => void setzeAnhangOrdner(an)}') && store.includes('window.jmps.setzeAnhangOrdner({ an })'));
  // Restpunkt P1 (G8): das Panel fragt kopfSichtbar statt nur kopf.text; ohne Text kein leerer Statusabsatz, Schalter bleibt
  ck('Restpunkt P1 (G8): das Panel rendert den Kopf nach kopfSichtbar(kopf), nicht nur bei kopf.text !== null',
    panel.includes('        {kopfSichtbar(kopf) && anhangOrdner && (\n          <OrdnerKopf\n') && !panel.includes('kopf.text !== null && anhangOrdner'));
  const ordnerKopf = panel.slice(panel.indexOf('function OrdnerKopf({'), panel.indexOf('function OrdnerZeileAnzeige({'));
  ck('Restpunkt P1 (G8): OrdnerKopf zeigt den Statusabsatz nur mit Text, Schalter und „Ordner öffnen“ unabhängig davon',
    ordnerKopf.includes('      {kopf.text !== null && (\n        <p role="status"') && ordnerKopf.includes('      {(kopf.schalter || kopf.ordnerOeffnen) && ('));
  ck('P32 9.11 (T52): unter „Keine iveo-gebundene Show geöffnet.“ steht in K0 der Satz zur Ablage',
    panel.includes("            {kopf.fall === 'K0' && (") && panel.includes('{ORDNER_ZEILEN_TEXTE.keineShow}'));
  ck('P32 9.15: Stand beim Öffnen des Panels und aus dem Ereignis iveo-anhang-ordner',
    funktionsKoerper(store, '    openSideEvents: () => {').includes('window.jmps.anhangOrdnerStand().then((stand) => set({ anhangOrdner: stand }))')
    && store.includes("          } else if (e.type === 'iveo-anhang-ordner') {") && store.includes('            set({ anhangOrdner: e.stand });'));
  ck('P32 11.1, 11.2: Zeilen nur in K7–K10; Texte T26, T30, T52, T65 nur aus ORDNER_ZEILEN_TEXTE',
    panel.includes("  const zeilenSichtbar = kopf.fall === 'K7' || kopf.fall === 'K8' || kopf.fall === 'K9' || kopf.fall === 'K10';")
    && !['Ordner öffnen<', '>Ordner öffnen', 'Anhänge in Side-Event-Ordnern', 'Weitere Side Events der Ablage<', 'Anhänge werden erst'].some((t) => panel.includes(t)));
  // Fix-Runde 1 (G8): in K8 (erste Runde ausstehend, nach neueSitzung oder Neubinden) ist die Menge unbekannt; ein Side Event
  // ohne Eintrag im Stand bekommt dort keine Zeile (nicht S1 „kein Ordner“), nach der ersten Runde S1 wie bisher.
  {
    const k8: AnhangOrdnerStand = { showOffen: true, rolle: 'aus', tokenDa: true, schalterAn: true, showDatei: 'da', sperre: null, basis: null,
      runde: null, ersteRundeGestartet: false, durchsichtFertig: false, naechsteRundeGegen: null, letzterFortschritt: null, sideEvents: [] } as unknown as AnhangOrdnerStand;
    const k9: AnhangOrdnerStand = { ...k8, ersteRundeGestartet: true, durchsichtFertig: true };
    ck('P32 G8: K8 ohne Eintrag im Stand → keine Zeile (Menge unbekannt), nach der ersten Runde S1',
      kopfzeile(k8, 0).fall === 'K8' && listenZeile(k8, 'p-1', 0) === null
      && listenZeile(k9, 'p-1', 0)?.fall === 'S1');
    // Fix-Runde 2: auch nach dem Start der ersten Runde ist die Menge außerhalb erst nach der ersten Durchsicht bekannt
    const k9a: AnhangOrdnerStand = { ...k9, durchsichtFertig: false };
    ck('P32 G8 (R2): ohne Eintrag vor dem Ende der ersten Durchsicht keine Zeile, danach S1',
      kopfzeile(k9a, 0).fall === 'K10' &&listenZeile(k9a, 'p-1', 0) === null && listenZeile(k9, 'p-1', 0)?.fall === 'S1');
    ck('P32 G8: das Panel fragt listenZeile statt ordnerZeile(ordnerVon(...)) für die Liste',
      quelleLf('../src/renderer/src/components/SideEventsPanel.tsx').includes('listenZeile(anhangOrdner, programId, ordnerUhr)'));
  }
}

// --- iveo-Paket P34 · Release-Wahl: neuestes Release mit passendem Paket (Spec 10.4, 10.5, 12.7 Nr. 1–3) -----------
// Die Tabelle services/release-proxy/test/paketwahl-faelle.json liest auch der Proxy-Test (worker.test.mjs, Fall 23):
// eine Regel, zwei Umsetzungen, eine Tabelle (EP4). Fälle mit nurLauncher prüfen den genauen Katalognamen, den nur die
// GitHub-Quelle des Launchers kennt.
await (async () => {
  type Erwartet = { art: 'gewaehlt'; version: string; asset: string } | { art: 'kein-release' } | { art: 'kein-paket' };
  interface Fall {
    name: string; app: string; praefix: string; plattform: 'mac' | 'win'; arch: 'arm64' | 'x64';
    genauerName?: string; nurLauncher?: boolean; releases: ReleaseEintrag[]; erwartet: Erwartet;
  }
  const tabelle = JSON.parse(
    readFileSync(new URL('../../../services/release-proxy/test/paketwahl-faelle.json', import.meta.url), 'utf8'),
  ) as { faelle: Fall[] };
  const nurLauncher = tabelle.faelle.filter((f) => f.nurLauncher === true).length;
  ck(`P34 12.7 Nr. 1: Tabelle gelesen (${tabelle.faelle.length} Fälle, ${nurLauncher} davon nur für die GitHub-Quelle)`,
    tabelle.faelle.length === 26 && nurLauncher === 4);
  const kurz = (e: Erwartet): string => (e.art === 'gewaehlt' ? `${e.version} · ${e.asset}` : e.art);
  let mitRelease = true;
  for (const f of tabelle.faelle) {
    const vorlage = f.genauerName;
    const genau = vorlage === undefined ? undefined : (version: string): string => vorlage.split('${version}').join(version);
    const w = waehleRelease(f.releases, f.praefix, f.plattform, f.arch, genau);
    const ist = kurz(w.art === 'gewaehlt' ? { art: 'gewaehlt', version: w.version, asset: w.asset.name } : w);
    if (ist !== kurz(f.erwartet)) console.log(`      erwartet ${kurz(f.erwartet)}, ist ${ist}`);
    if (w.art === 'gewaehlt' && w.release.tag_name !== `${f.praefix}${w.version}`) mitRelease = false;
    ck(`P34 12.7 Nr. 1: ${f.name}`, ist === kurz(f.erwartet));
  }
  ck('P34 10.5: die Wahl liefert das gewählte Release mit (Tag = Präfix + Version)', mitRelease);

  ck('P34 12.7 Nr. 3 EP2: compareVersions numerisch (0.10.0 > 0.2.0, 0.2.0 < 0.10.0, gleich = 0)',
    compareVersions('0.10.0', '0.2.0') > 0 && compareVersions('0.2.0', '0.10.0') < 0 && compareVersions('1.2.3', '1.2.3') === 0);
  ck('P34 12.7 Nr. 3 EP2: fehlender Teil zählt 0 (1.2 = 1.2.0, 1.2.1 > 1.2)',
    compareVersions('1.2', '1.2.0') === 0 && compareVersions('1.2.1', '1.2') > 0);
  ck('P34 12.7 Nr. 3 EP2: nicht numerischer Teil zählt 0, Vorabkennung wie parseInt (1.x.0 = 1.0.0, 1.0.0-beta = 1.0.0, 0.3.1-rc1 > 0.3.0)',
    compareVersions('1.x.0', '1.0.0') === 0 && compareVersions('1.0.0-beta', '1.0.0') === 0 && compareVersions('0.3.1-rc1', '0.3.0') > 0);

  ck('P34 12.7 Nr. 2: proxyFehlerText mit JSON-error → „Proxy 404: …“ (F2, F3)',
    proxyFehlerText(404, 'Not Found', '{"error":"kein Release für connect"}') === 'Proxy 404: kein Release für connect'
    && proxyFehlerText(404, 'Not Found', '{"error":"kein Release von connect mit einem Paket für macOS (x64)"}')
      === 'Proxy 404: kein Release von connect mit einem Paket für macOS (x64)');
  ck('P34 12.7 Nr. 2: 401 und 5xx mit JSON-error (F4, F5)',
    proxyFehlerText(401, 'Unauthorized', '{"error":"unauthorized"}') === 'Proxy 401: unauthorized'
    && proxyFehlerText(502, 'Bad Gateway', '{"error":"GitHub API 500 Internal Server Error"}') === 'Proxy 502: GitHub API 500 Internal Server Error');
  ck('P34 12.7 Nr. 2: JSON ohne nutzbares error (Feld fehlt, kein String, leer, Array, null) → „Proxy ‹Status› ‹Statustext›“',
    ['{"message":"x"}', '{"error":{"code":1}}', '{"error":" \\n "}', '["error"]', 'null']
      .every((b) => proxyFehlerText(500, 'Internal Server Error', b) === 'Proxy 500 Internal Server Error'));
  ck('P34 12.7 Nr. 2: kein JSON oder leerer Text → „Proxy ‹Status› ‹Statustext›“ wie bisher (F6)',
    proxyFehlerText(502, 'Bad Gateway', '<html>Bad Gateway</html>') === 'Proxy 502 Bad Gateway'
    && proxyFehlerText(404, 'Not Found', '') === 'Proxy 404 Not Found');
  ck('P34 12.7 Nr. 2: langer Text auf 200 Zeichen gekürzt (Codepunkte, kein Emoji zerschnitten)',
    proxyFehlerText(500, 'x', JSON.stringify({ error: 'x'.repeat(300) })) === `Proxy 500: ${'x'.repeat(200)}`
    && proxyFehlerText(500, 'x', JSON.stringify({ error: '😀'.repeat(250) })) === `Proxy 500: ${'😀'.repeat(200)}`);
  ck('P34 12.7 Nr. 2: Zeilenumbrüche werden Leerzeichen',
    proxyFehlerText(502, 'Bad Gateway', JSON.stringify({ error: 'Zeile 1\nZeile 2\r\nZeile 3\rZeile 4' })) === 'Proxy 502: Zeile 1 Zeile 2 Zeile 3 Zeile 4');

  const antwort = (status: number, statusText: string, body: string | (() => string)): ProxyAntwortLike => ({
    ok: status >= 200 && status < 300, status, statusText,
    text: async () => (typeof body === 'function' ? body() : body),
    json: async () => JSON.parse(typeof body === 'function' ? body() : body) as unknown,
  });
  const meldung = async (r: ProxyAntwortLike): Promise<string> => {
    try { await proxyAntwortAuswerten(r, 'mac'); return 'kein Wurf'; } catch (e) { return (e as Error).message; }
  };
  ck('P34 12.7 Nr. 2: proxyAntwortAuswerten, 404 mit JSON-error → Fehler mit dem Text des Proxys (F3)',
    (await meldung(antwort(404, 'Not Found', '{"error":"kein Release von connect mit einem Paket für macOS (x64)"}')))
      === 'Proxy 404: kein Release von connect mit einem Paket für macOS (x64)');
  ck('P34 12.7 Nr. 2: 404 ohne JSON → „Proxy 404 Not Found“', (await meldung(antwort(404, 'Not Found', 'Not Found'))) === 'Proxy 404 Not Found');
  ck('P34 12.7 Nr. 2: text() wirft → leerer Text → „Proxy 404 Not Found“',
    (await meldung(antwort(404, 'Not Found', () => { throw new Error('Strom abgerissen'); }))) === 'Proxy 404 Not Found');
  const paket = { url: 'https://signed.test/103', size: 80, fileName: 'JM.Connect-0.3.0-mac-arm64.dmg' };
  const gut = await proxyAntwortAuswerten(antwort(200, 'OK', JSON.stringify({ version: '0.3.0', assets: { mac: paket } })), 'mac');
  ck('P34 12.7 Nr. 2: 200 mit gültigem Ergebnis → Version und Paket', JSON.stringify(gut) === JSON.stringify({ version: '0.3.0', asset: paket }));
  const ohne = await proxyAntwortAuswerten(antwort(200, 'OK', JSON.stringify({ version: '0.3.0', assets: { win: paket } })), 'mac');
  ck('P34 11.5 F8: 200 ohne Paket für diese Plattform → asset null (der Installer zeigt T29)', ohne.version === '0.3.0' && ohne.asset === null);
  ck('P34 12.7 Nr. 2: 200 ohne JSON oder ohne Version → „Proxy 200 OK“ (F6)',
    (await meldung(antwort(200, 'OK', '<html>'))) === 'Proxy 200 OK' && (await meldung(antwort(200, 'OK', '{"assets":{}}'))) === 'Proxy 200 OK');

  ck('P34 12.7 Nr. 3: keinPaketText T29 (a) und (b) wörtlich',
    keinPaketText('mac', 'x64', 'tool') === 'Kein Release mit einem Paket für diesen Rechner gefunden (macOS, Launcher-Architektur x64).'
    && keinPaketText('win', 'x64', 'tool') === 'Kein Release mit einem Paket für diesen Rechner gefunden (Windows).');
  ck('P34 12.7 Nr. 3: keinPaketText T69 (a) und (b) wörtlich',
    keinPaketText('mac', 'arm64', 'launcher') === 'Kein Launcher-Installer für diesen Rechner gefunden (macOS, Launcher-Architektur arm64).'
    && keinPaketText('win', 'arm64', 'launcher') === 'Kein Launcher-Installer für diesen Rechner gefunden (Windows).');
})();

// --- iveo-Paket P35 · Quelle, Updates und Installer nutzen die Release-Wahl (Spec 10.4, 10.5 Nr. 7, 11.5; EP13) ----
// release-source.ts lädt über ./settings Electron, updates.ts und installer.ts laden es direkt: Sie laufen hier nicht.
// Geprüft wird am Quelltext, dass sie nur die reinen Helfer aus release-wahl.ts rufen und die alten Texte weg sind.
{
  const main = (datei: string): string => readFileSync(new URL(`../src/main/${datei}`, import.meta.url), 'utf8');
  const quelle = main('release-source.ts');
  const updates = main('updates.ts');
  const installer = main('installer.ts');
  ck('P35 10.4: release-source.ts verwirft den Fehlertext des Proxys nicht mehr (ruft proxyAntwortAuswerten)',
    !quelle.includes('throw new Error(`Proxy ${res.status} ${res.statusText}`)') && quelle.includes('return proxyAntwortAuswerten(res, platform);'));
  ck('P35 10.4 EP2: release-source.ts ohne eigenes compareVersions und ohne pickHighestRelease',
    !/function compareVersions\b/.test(quelle) && !quelle.includes('pickHighestRelease'));
  ck('P35 10.5: die GitHub-Quelle wählt über waehleRelease mit dem genauen Katalognamen',
    quelle.includes('return waehleRelease(releases, `${tool.app}-v`, plattform, archToken(), (version) => resolveArtifactName(tool, version));'));
  ck('P35 10.5 Nr. 7: latestVersion folgt der Wahl (GitHub nur gewählt, Proxy nur mit Paket)',
    quelle.includes("return wahl?.art === 'gewaehlt' ? wahl.version : null;") && quelle.includes('return r?.asset ? r.version : null;'));
  ck('P35 EP2: updates.ts importiert compareVersions aus ./release-wahl, release-source.ts exportiert es nicht weiter',
    updates.includes("import { compareVersions } from './release-wahl';") && !/compareVersions/.test(quelle));
  ck('P35 11.5 F8, F11: installer.ts ohne die alten Texte, mit keinPaketText für Tool und Launcher (T29, T69)',
    !installer.includes('Kein passendes Artefakt für diese Plattform gefunden.') && !installer.includes('Kein Launcher-Installer für diese Plattform gefunden.')
    && installer.includes("keinPaketText(plattformHier(), archToken(), 'tool')") && installer.includes("keinPaketText(plattformHier(), archToken(), 'launcher')"));
  ck('P35 11.5 F1, T27, F10: Bestandstexte wörtlich',
    installer.includes("'Keine Release-Quelle konfiguriert — Token oder Proxy in den Einstellungen hinterlegen.'")
    && installer.includes('`Release-Abfrage fehlgeschlagen: ${(e as Error).message}`')
    && installer.includes('`Update-Abfrage fehlgeschlagen: ${(e as Error).message}`')
    && installer.includes("'Keine Release-Quelle konfiguriert — Token in den Einstellungen hinterlegen.'"));
}

// --- Geführte Anleitungen P6 (Spec 4, 5, 7; Plan 9.1, 9.3, EP5, EP6, EP22): die Anleitungs-Datei „Einrichtung“ ---------
// Der Ablaufkern kommt aus @jm/ui/anleitung (Block A; ohne Laufzeit-Importe und darum hier unter strip-types ladbar, MP1).
// Die Texte stehen hier ein zweites Mal als Tabelle: Jede Änderung an einem Text der Owner-Freigabe fällt auf (G2).
{
  // Namen der Bedingungen aus dem Zustands-Adapter (P8): Jede Bedingung der Anleitung nennt einen Namen, den der Adapter liefert.
  // Dazu das Ereignis, das der Kern nach dem erledigten Neustart selbst merkt (neustart:‹Schritt-ID›, Ruling R-Task6-Neustart).
  const NAMEN_EINRICHTUNG = { zustaende: ZUSTANDS_NAMEN, ereignisse: [...EREIGNIS_NAMEN, 'neustart:k5.neustart'], entscheidungen: ENTSCHEIDUNGS_NAMEN };
  const befunde = pruefeAnleitung(EINRICHTUNG, NAMEN_EINRICHTUNG);
  ck(`P6 7: pruefeAnleitung findet nichts an der Anleitung „Einrichtung“${befunde.length ? ` — ${befunde.join('; ')}` : ''}`,
    befunde.length === 0);
  ck('P6 5: sechs Kapitel k1–k6 in dieser Reihenfolge, jedes mit „Brauche ich nicht“ (EP22)',
    EINRICHTUNG.id === 'einrichtung' && EINRICHTUNG.kapitel.map((k) => k.id).join(',') === 'k1,k2,k3,k4,k5,k6'
    && EINRICHTUNG.kapitel.every((k) => k.brauchtNicht === true));

  // A1–A48 wörtlich: [Nr., wo, Text]; wo = feste Blase, Kapitel:Feld oder Schritt-ID.
  const A: Array<[string, string, string]> = [
    ['A1', 'einleitung', 'Willkommen bei der JM Production Suite. Ich führe dich in sechs Schritten durch die Einrichtung. Du kannst jederzeit pausieren und später weitermachen.'],
    ['A2', 'rueckfrage', 'Willst du die Anleitung wirklich überspringen? Du findest sie jederzeit oben unter „Erste Schritte“.'],
    ['A3', 'abschluss', 'Das war die Einrichtung. Alle Schritte findest du jederzeit unter „Erste Schritte“, offene kannst du dort fortsetzen.'],
    ['A4', 'k1:titel', 'Anmelden'],
    ['A5', 'k1:kurz', 'Proxy-Schlüssel oder GitHub-Zugang hinterlegen, damit Tools installiert und aktualisiert werden können.'],
    ['A6', 'k1:erledigt', 'Dieser Rechner ist schon mit der Release-Quelle verbunden. Du kannst gleich weitermachen.'],
    ['A7', 'k1.einstellungen', 'Damit der Launcher Tools laden kann, braucht er eine Verbindung zur Release-Quelle. Öffne dazu die Einstellungen.'],
    ['A8', 'k1.zugang', 'Trage hier den Proxy-Schlüssel oder deinen GitHub-Zugang ein und klicke auf „Speichern“. Ohne Internet geht das nicht; dann überspringe diesen Schritt.'],
    ['A9', 'k2:titel', 'Tools installieren'],
    ['A10', 'k2:kurz', 'Im Werkzeugkasten die Tools für deine Produktion auswählen und installieren.'],
    ['A11', 'k2:erledigt', 'Auf diesem Rechner ist schon mindestens ein Tool installiert.'],
    ['A12', 'k2.reiter', 'Alle Tools der Suite findest du im Werkzeugkasten. Öffne den Reiter „Werkzeugkasten“.'],
    ['A13', 'k2.katalog', 'Das ist der Katalog. Mit den Kategorien und der Suche findest du schnell das passende Tool.'],
    ['A14', 'k2.installieren', 'Wähle ein Tool für deine Produktion und klicke auf „Installieren“. Ohne Internet geht das nicht; dann überspringe diesen Schritt.'],
    ['A15', 'k3:titel', 'Rolle im Verbund wählen und koppeln'],
    ['A16', 'k3:kurz', 'Festlegen, ob dieser Rechner allein arbeitet, Master ist oder sich mit einem Master verbindet.'],
    ['A17', 'k3:erledigt', 'Die Rolle dieses Rechners im Verbund ist schon eingerichtet.'],
    ['A18', 'k3.verbund', 'Arbeiten mehrere Rechner zusammen, ist einer der Master und verteilt die Show. Die anderen verbinden sich mit ihm.'],
    ['A19', 'k3.allein', 'Arbeitest du allein an diesem Rechner? Dann brauchst du keinen Verbund.'],
    ['A20', 'k3.oeffnen', 'Öffne den Verbund mit einem Klick auf die Verbund-Anzeige oben.'],
    ['A21', 'k3.rolle', 'Wähle „Master“ für den Rechner, der die Show verteilt, oder „Mit Master verbinden“ für alle anderen.'],
    ['A22', 'k3.master', 'Mit „Rechner koppeln“ zeigt der Master einen Code. Gib ihn am anderen Rechner unter „Mit Master verbinden“ ein. Ohne zweiten Rechner machst du das später.'],
    ['A23', 'k3.slave', 'Wähle deinen Master in der Liste oder trage seine Adresse ein. Gib dann den Code ein, den der Master unter „Rechner koppeln“ zeigt, und klicke auf „Koppeln“. Ohne Master im Netz geht das nicht; dann überspringe diesen Schritt.'],
    ['A24', 'k4:titel', 'Erste Show anlegen und an ein iveo-Event binden'],
    ['A25', 'k4:kurz', 'Wähle, was du produzierst (Konferenz, Battle, Bühne, Podcast), und speichere die passende Show.'],
    ['A26', 'k4:erledigt', 'Die erste Show hast du an diesem Rechner schon gespeichert oder vom Master bekommen.'],
    ['A27', 'k4.reiter', 'Shows legst du im Reiter „JM Show“ an. Öffne ihn.'],
    ['A28', 'k4.slave', 'An diesem Rechner kommt die Show vom Master; iveo und Tokens bleiben dort. Die Anleitung kann das hier nicht selbst sehen: Zeigen deine Tools die Show des Masters?'],
    ['A29', 'k4.vorlage', 'Am schnellsten geht es mit einer Vorlage. Klicke bei „Aus Vorlage starten“ auf „Vorlage wählen“.'],
    ['A30', 'k4.szenario', 'Wähle, was du produzierst, und klicke auf „Los“. Der Show-Editor übernimmt die passenden Tools.'],
    ['A31', 'k4.name', 'Gib der Show einen Namen, an dem du sie wiedererkennst.'],
    ['A32', 'k4.iveo', 'Arbeitest du mit einem iveo-Event, bindest du es hier mit Token und Event an. Ohne iveo klickst du einfach auf „Weiter“.'],
    ['A33', 'k4.speichern', 'Speichere die Show. Das startet noch keine Tools; das kommt im letzten Schritt.'],
    ['A34', 'k5:titel', 'Fernsteuerung für Companion einrichten'],
    ['A35', 'k5:kurz', 'Sehen, ob sich die Tools im Netz finden, und Companion anbinden; am Einzelplatz mit der sicheren Steuerebene.'],
    ['A36', 'k5:erledigt', 'Du hast schon bestätigt, dass Companion mit diesem Rechner verbunden ist.'],
    ['A37', 'k5.system', 'Mit Companion steuerst du die Tools zum Beispiel per Stream Deck. Öffne dazu den System-Zustand. Ohne Companion überspringe diesen Schritt.'],
    ['A38', 'k5.sicher', 'Am Einzelplatz empfehle ich die sichere Steuerebene. Klicke auf „Sichere Steuerebene aktivieren“; bleibst du beim offenen Modus, klicke auf „Weiter“.'],
    ['A39', 'k5.neustart', 'Die sichere Steuerebene wirkt erst nach einem Neustart. Beende laufende Tools und den Launcher und starte den Launcher neu. Danach geht es hier weiter.'],
    ['A40', 'k5.companion', 'Trag Token und Fingerprint in Companion ein oder scanne den QR-Code. Token und QR-Code zeigt die Karte nur direkt nach dem Aktivieren oder Erneuern. Fehlt das Token hier und hat Companion es noch nicht, erzeugt „Erneuern“ ein neues; das braucht wieder einen Neustart.'],
    ['A41', 'k5.verbund', 'Im Verbund trägt die sichere Steuerebene über mehrere Rechner noch nicht: Ein Rechner im sicheren Modus findet die offenen nicht. Companion verbindest du im Verbund darum im offenen Modus.'],
    ['A42', 'k5.bestaetigen', 'Verbinde Companion mit diesem Rechner. Klappt die Verbindung, bestätige es hier. Ohne Companion überspringe diesen Schritt.'],
    ['A43', 'k6:titel', 'Tools aus der Show starten'],
    ['A44', 'k6:kurz', 'Die Show öffnen: Der Launcher startet die Tools, die darin stehen.'],
    ['A45', 'k6:erledigt', 'Du hast schon Tools aus einer Show gestartet.'],
    ['A46', 'k6.master', 'Achtung: Am Master verteilt das Öffnen einer Show sie an den ganzen Verbund. Am Timer der anderen Rechner beginnt der Countdown dann neu.'],
    ['A47', 'k6.oeffnen', 'Öffne jetzt deine Show mit „Show öffnen“. Der Launcher startet die Tools, die darin stehen; den Klick machst du selbst.'],
    ['A48', 'wiederfinden', 'Übersprungenes findest du jederzeit oben unter „Erste Schritte“.'],
  ];
  const schritte: AnleitungsSchritt[] = [EINRICHTUNG.einleitung, EINRICHTUNG.rueckfrage, EINRICHTUNG.abschluss,
    ...EINRICHTUNG.kapitel.flatMap((k) => k.schritte)];
  const textVon = (wo: string): string | undefined => {
    if (wo === 'wiederfinden') return EINRICHTUNG.wiederfinden;
    const [kid, feld] = wo.split(':');
    const k = EINRICHTUNG.kapitel.find((x) => x.id === kid);
    if (k && (feld === 'titel' || feld === 'kurz' || feld === 'erledigt')) return k[feld];
    return schritte.find((s) => s.id === wo)?.text;
  };
  const aAbw = A.filter(([, wo, soll]) => textVon(wo) !== soll).map(([nr]) => nr);
  ck(`P6 9.1: A1–A48 wörtlich (${A.length} Texte)${aAbw.length ? ` — abweichend: ${aAbw.join(', ')}` : ''}`,
    A.length === 48 && aAbw.length === 0);

  // Aufbau je Schritt nach 9.1 (Art, Ziel, „Ziel fehlt“, Eingriff, Hinweis Überspringen, gilt nur, wenn, erledigt, wenn, Optionen).
  const z = (n: string): Bedingung => ({ zustand: n });
  const ev = (n: string): Bedingung => ({ ereignis: n });
  const en = (n: string): Bedingung => ({ entscheidung: n });
  const alle = (...b: Bedingung[]): Bedingung => ({ alle: b });
  const eine = (...b: Bedingung[]): Bedingung => ({ eineVon: b });
  const nicht = (b: Bedingung): Bedingung => ({ nicht: b });
  const VERBUND = eine(z('rolleMaster'), z('rolleSlave'));
  const EINZEL = nicht(VERBUND);
  const NICHT_SLAVE = nicht(z('rolleSlave'));
  const SICHER = z('steuerebeneSicher');
  const EDITOR = 'Der Show-Editor ist nicht offen. Klicke bei „Aus Vorlage starten“ auf „Vorlage wählen“.';
  const KOPF = 'Ich sehe den Knopf oben rechts gerade nicht. Zieh das Fenster breiter.';
  const REITER = 'Ich sehe die Reiter oben links gerade nicht. Zieh das Fenster größer.';
  type Soll = {
    id: string; art: string; ziel?: string; zielFehlt?: string; eingriff?: true; hinweis?: true;
    gilt?: Bedingung; erledigt?: Bedingung; optionen?: Array<[string, string | null]>;
  };
  const SOLL: Soll[] = [
    { id: 'einleitung', art: 'erklaeren' },
    { id: 'rueckfrage', art: 'erklaeren', ziel: 'kopf.erste-schritte', zielFehlt: KOPF },
    { id: 'abschluss', art: 'erklaeren', ziel: 'kopf.erste-schritte', zielFehlt: KOPF },
    { id: 'k1.einstellungen', art: 'handeln', ziel: 'kopf.einstellungen', zielFehlt: KOPF, erledigt: z('einstellungenOffen') },
    { id: 'k1.zugang', art: 'handeln', ziel: 'einstellungen.zugang', zielFehlt: 'Öffne zuerst oben die Einstellungen.', hinweis: true,
      erledigt: z('quelleVerbunden') },
    { id: 'k2.reiter', art: 'handeln', ziel: 'reiter.werkzeugkasten', zielFehlt: REITER, erledigt: z('reiterWerkzeugkasten') },
    { id: 'k2.katalog', art: 'erklaeren', ziel: 'werkzeugkasten.kategorien', zielFehlt: 'Öffne zuerst den Reiter „Werkzeugkasten“.' },
    { id: 'k2.installieren', art: 'handeln', ziel: 'werkzeugkasten.installieren',
      zielFehlt: 'Ich sehe gerade kein Tool zum Installieren. Stelle den Filter über dem Katalog auf „Alle“.', hinweis: true,
      erledigt: z('toolInstalliert') },
    { id: 'k3.verbund', art: 'erklaeren', ziel: 'kopf.verbund',
      zielFehlt: 'Die Verbund-Anzeige ist gerade nicht zu sehen. Du findest den Verbund auch in den Einstellungen.' },
    { id: 'k3.allein', art: 'entscheiden', optionen: [['Ich arbeite allein an diesem Rechner', 'allein'], ['Verbund einrichten', null]] },
    { id: 'k3.oeffnen', art: 'handeln', ziel: 'kopf.verbund', zielFehlt: 'Öffne die Einstellungen und klicke dort auf „Verbund öffnen“.',
      erledigt: z('verbundOffen') },
    { id: 'k3.rolle', art: 'handeln', ziel: 'verbund.rollen',
      zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, lädt er noch oder sagt dort, warum die Rollen fehlen.', eingriff: true,
      erledigt: VERBUND },
    { id: 'k3.master', art: 'erklaeren', ziel: 'verbund.koppeln-master',
      zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, läuft der Master noch nicht: Warte kurz oder lies dort unter „Master“, was ihn aufhält.',
      hinweis: true, gilt: z('rolleMaster') },
    { id: 'k3.slave', art: 'handeln', ziel: 'verbund.code',
      zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, ist dieser Rechner schon gekoppelt; ob er den Master erreicht, steht dort unter „Master“.',
      eingriff: true, hinweis: true, gilt: z('rolleSlave'), erledigt: alle(z('slaveGekoppelt'), ev('slaveWarVerbunden')) },
    { id: 'k4.reiter', art: 'handeln', ziel: 'reiter.show', zielFehlt: REITER, gilt: NICHT_SLAVE, erledigt: z('reiterShow') },
    { id: 'k4.slave', art: 'entscheiden', gilt: z('rolleSlave'), optionen: [['Die Show ist da', 'showVomMaster']] },
    { id: 'k4.vorlage', art: 'handeln', ziel: 'show.vorlage', zielFehlt: 'Öffne zuerst den Reiter „JM Show“.', gilt: NICHT_SLAVE,
      erledigt: z('szenarienOffen') },
    { id: 'k4.szenario', art: 'handeln', ziel: 'szenario.auswahl', zielFehlt: 'Klicke zuerst bei „Aus Vorlage starten“ auf „Vorlage wählen“.',
      gilt: NICHT_SLAVE, erledigt: z('editorOffen') },
    { id: 'k4.name', art: 'erklaeren', ziel: 'editor.name', zielFehlt: EDITOR, gilt: NICHT_SLAVE },
    { id: 'k4.iveo', art: 'erklaeren', ziel: 'editor.iveo', zielFehlt: EDITOR, gilt: NICHT_SLAVE },
    { id: 'k4.speichern', art: 'handeln', ziel: 'editor.speichern', zielFehlt: EDITOR, gilt: NICHT_SLAVE, erledigt: ev('showGespeichert') },
    { id: 'k5.system', art: 'handeln', ziel: 'kopf.system', zielFehlt: KOPF, hinweis: true, gilt: EINZEL, erledigt: z('systemOffen') },
    { id: 'k5.sicher', art: 'erklaeren', ziel: 'system.sicher', zielFehlt: 'Öffne zuerst den System-Zustand.', eingriff: true,
      gilt: alle(EINZEL, nicht(SICHER)) },
    { id: 'k5.companion', art: 'erklaeren', ziel: 'system.steuerebene', zielFehlt: 'Öffne den System-Zustand.', gilt: alle(EINZEL, SICHER) },
    { id: 'k5.neustart', art: 'neustart', eingriff: true, gilt: alle(EINZEL, SICHER, ev('steuerebeneAktiviert'), nicht(ev('neustart:k5.neustart'))) },
    { id: 'k5.verbund', art: 'erklaeren', gilt: VERBUND },
    { id: 'k5.bestaetigen', art: 'entscheiden', hinweis: true, optionen: [['Companion ist verbunden', 'companionVerbunden']] },
    { id: 'k6.master', art: 'erklaeren', gilt: z('rolleMaster') },
    { id: 'k6.oeffnen', art: 'handeln', ziel: 'kopf.show-oeffnen', zielFehlt: KOPF, eingriff: true, erledigt: z('showGestartet') },
  ];
  const formIst = (s: AnleitungsSchritt): string => JSON.stringify({
    id: s.id, art: s.art, ziel: s.ziel ?? null, zielFehlt: s.zielFehlt ?? null, eingriff: s.eingriff === true,
    hinweis: s.ueberspringenHinweis === true, gilt: s.giltWenn ?? null, erledigt: s.erledigtWenn ?? null,
    optionen: (s.optionen ?? []).map((o) => [o.knopf, o.entscheidung ?? null]),
  });
  const formSoll = (s: Soll): string => JSON.stringify({
    id: s.id, art: s.art, ziel: s.ziel ?? null, zielFehlt: s.zielFehlt ?? null, eingriff: s.eingriff === true,
    hinweis: s.hinweis === true, gilt: s.gilt ?? null, erledigt: s.erledigt ?? null, optionen: s.optionen ?? [],
  });
  const aufbauAbw = SOLL.filter((s, i) => schritte[i] === undefined || formSoll(s) !== formIst(schritte[i])).map((s) => s.id);
  ck(`P6 9.1: Aufbau je Schritt nach 9.1 (${SOLL.length} Schritte)${aufbauAbw.length || schritte.length !== SOLL.length
    ? ` — abweichend: ${aufbauAbw.join(', ')} (ist ${schritte.length} Schritte)` : ''}`,
    schritte.length === SOLL.length && aufbauAbw.length === 0);
  const KAPITEL_SOLL: Record<string, Bedingung> = {
    k1: z('quelleVerbunden'),
    k2: z('toolInstalliert'),
    k3: eine(z('rolleMaster'), alle(z('slaveGekoppelt'), ev('slaveWarVerbunden')), alle(z('rolleAus'), en('allein'))),
    k4: eine(alle(NICHT_SLAVE, ev('showGespeichert')), alle(z('rolleSlave'), en('showVomMaster'))),
    k5: en('companionVerbunden'),
    k6: z('showGestartet'),
  };
  const kapAbw = EINRICHTUNG.kapitel.filter((k) => JSON.stringify(k.erledigtWenn) !== JSON.stringify(KAPITEL_SOLL[k.id])).map((k) => k.id);
  ck(`P6 9.1: „erledigt, wenn“ je Kapitel nach 9.1${kapAbw.length ? ` — abweichend: ${kapAbw.join(', ')}` : ''}`, kapAbw.length === 0);

  // Kapitel je nach Rolle (Spec 5; EP6: Rolle unbekannt = Einzelplatz-Texte).
  const leer = leererFortschritt('einrichtung');
  const ROLLEN: Array<[string, Record<string, boolean>]> = [
    ['aus', { rolleAus: true }], ['master', { rolleMaster: true }], ['slave', { rolleSlave: true }], ['unbekannt', {}],
  ];
  const EINZELPLATZ_SCHRITTE = 'k1:einstellungen,zugang|k2:reiter,katalog,installieren|k3:verbund,allein,oeffnen,rolle'
    + '|k4:reiter,vorlage,szenario,name,iveo,speichern|k5:system,sicher,bestaetigen|k6:oeffnen';
  const GELTEND: Record<string, string> = {
    aus: EINZELPLATZ_SCHRITTE,
    master: 'k1:einstellungen,zugang|k2:reiter,katalog,installieren|k3:verbund,allein,oeffnen,rolle,master'
      + '|k4:reiter,vorlage,szenario,name,iveo,speichern|k5:verbund,bestaetigen|k6:master,oeffnen',
    slave: 'k1:einstellungen,zugang|k2:reiter,katalog,installieren|k3:verbund,allein,oeffnen,rolle,slave'
      + '|k4:slave|k5:verbund,bestaetigen|k6:oeffnen',
    unbekannt: EINZELPLATZ_SCHRITTE,
  };
  const geltend = (zst: Record<string, boolean>): string => EINRICHTUNG.kapitel
    .map((k) => `${k.id}:${geltendeSchritte(EINRICHTUNG, k.id, zst, leer).map((s) => s.id.slice(k.id.length + 1)).join(',')}`).join('|');
  const rollenAbw = ROLLEN.filter(([r, zst]) => geltend(zst) !== GELTEND[r]).map(([r, zst]) => `${r}: ${geltend(zst)}`);
  ck(`P6 5: geltende Schritte je Rolle nach 9.1 (aus, Master, Slave, unbekannt wie Einzelplatz)${rollenAbw.length
    ? ` — ${rollenAbw.join(' / ')}` : ''}`, rollenAbw.length === 0);
  let faelle = 0;
  const ohneSchritt: string[] = [];
  for (const [r, rz] of ROLLEN) for (const gekoppelt of [false, true]) for (const sicher of [false, true]) {
    faelle++;
    const zst = { ...rz, slaveGekoppelt: gekoppelt, slaveVerbunden: gekoppelt, steuerebeneSicher: sicher };
    for (const k of EINRICHTUNG.kapitel) {
      if (geltendeSchritte(EINRICHTUNG, k.id, zst, leer).length === 0) ohneSchritt.push(`${r}/${gekoppelt ? 'gekoppelt' : 'frei'}/${sicher ? 'sicher' : 'offen'}: ${k.id}`);
    }
  }
  ck(`P6 5: Rollen-Kreuz Rolle × gekoppelt × Steuerebene: jedes Kapitel hat mindestens einen Schritt (${faelle} Fälle)${ohneSchritt.length
    ? ` — ohne Schritt: ${ohneSchritt.slice(0, 5).join(', ')}` : ''}`, faelle === 16 && ohneSchritt.length === 0);

  // Haken je Kapitel (EP5, G7): echte Zustände, gemerkte Ereignisse, ausdrückliche Entscheidungen; eine Voreinstellung zählt nie.
  const ZEIT = '2026-10-19T10:00:00.000Z';
  const mit = (ereignisse: string[], entscheidungen: string[]) => ({
    ...leer,
    ereignisse: Object.fromEntries(ereignisse.map((n) => [n, ZEIT])),
    entscheidungen: Object.fromEntries(entscheidungen.map((n) => [n, ZEIT])),
  });
  const ERLEDIGT: Array<[string, string, Record<string, boolean>, string[], string[], boolean]> = [
    ['k1 frisch', 'k1', {}, [], [], false],
    ['k1 Quelle verbunden', 'k1', { quelleVerbunden: true }, [], [], true],
    ['k2 frisch', 'k2', {}, [], [], false],
    ['k2 ein Tool installiert', 'k2', { toolInstalliert: true }, [], [], true],
    ['k3 Rolle aus ohne Entscheidung (Voreinstellung)', 'k3', { rolleAus: true }, [], [], false],
    ['k3 Rolle aus und allein', 'k3', { rolleAus: true }, [], ['allein'], true],
    ['k3 allein bei unbekannter Rolle', 'k3', {}, [], ['allein'], false],
    ['k3 allein am Slave', 'k3', { rolleSlave: true }, [], ['allein'], false],
    ['k3 Master', 'k3', { rolleMaster: true }, [], [], true],
    ['k3 Slave gekoppelt, nie verbunden', 'k3', { rolleSlave: true, slaveGekoppelt: true }, [], [], false],
    ['k3 Slave gekoppelt, war verbunden', 'k3', { rolleSlave: true, slaveGekoppelt: true }, ['slaveWarVerbunden'], [], true],
    ['k3 Slave entkoppelt, war verbunden', 'k3', { rolleSlave: true }, ['slaveWarVerbunden'], [], false],
    ['k4 Einzelplatz frisch', 'k4', { rolleAus: true }, [], [], false],
    ['k4 Einzelplatz Show gespeichert', 'k4', { rolleAus: true }, ['showGespeichert'], [], true],
    ['k4 Rolle unbekannt Show gespeichert', 'k4', {}, ['showGespeichert'], [], true],
    ['k4 Slave Show gespeichert', 'k4', { rolleSlave: true }, ['showGespeichert'], [], false],
    ['k4 Slave Show vom Master bestätigt', 'k4', { rolleSlave: true }, [], ['showVomMaster'], true],
    ['k4 Bestätigung ohne Slave', 'k4', { rolleAus: true }, [], ['showVomMaster'], false],
    ['k5 Einzelplatz offen', 'k5', { rolleAus: true, steuerebeneOffen: true }, [], [], false],
    ['k5 Einzelplatz sicher, eben aktiviert, nicht bestätigt', 'k5', { rolleAus: true, steuerebeneSicher: true }, ['steuerebeneAktiviert'], [], false],
    ['k5 Einzelplatz sicher nach dem Neustart, nicht bestätigt', 'k5', { rolleAus: true, steuerebeneSicher: true },
      ['steuerebeneAktiviert', 'neustart:k5.neustart'], [], false],
    ['k5 Master sicher', 'k5', { rolleMaster: true, steuerebeneSicher: true }, [], [], false],
    ['k5 Rolle unbekannt sicher', 'k5', { steuerebeneSicher: true }, [], [], false],
    ['k5 Einzelplatz offen, Companion bestätigt', 'k5', { rolleAus: true, steuerebeneOffen: true }, [], ['companionVerbunden'], true],
    ['k5 Einzelplatz sicher, Companion bestätigt', 'k5', { rolleAus: true, steuerebeneSicher: true }, ['steuerebeneAktiviert'],
      ['companionVerbunden'], true],
    ['k5 Verbund Companion bestätigt', 'k5', { rolleMaster: true }, [], ['companionVerbunden'], true],
    ['k6 frisch', 'k6', {}, [], [], false],
    ['k6 Show gestartet', 'k6', { showGestartet: true }, [], [], true],
  ];
  const erlAbw = ERLEDIGT.filter(([, k, zst, evs, ens, soll]) => (kapitelZustand(EINRICHTUNG, k, zst, mit(evs, ens)) === 'erledigt') !== soll)
    .map(([name]) => name);
  ck(`P6 5: Haken je Kapitel nach EP5, eine Voreinstellung zählt nie (${ERLEDIGT.length} Fälle)${erlAbw.length
    ? ` — falsch: ${erlAbw.join('; ')}` : ''}`, erlAbw.length === 0);

  // Kapitel 5 je Rolle und Steuerebene (Spec 5, EP5): am Einzelplatz empfohlen, nach dem Aktivieren Token und QR vor dem
  // Neustart, der Neustart nur nach einem Wechsel offen → sicher (Ereignis steuerebeneAktiviert), an jeder Rolle zuletzt die
  // Bestätigung „Companion ist verbunden“.
  const K5: Array<[string, Record<string, boolean>, string[], string]> = [
    ['Einzelplatz, Steuerebene nicht geladen', { rolleAus: true }, [], 'system,sicher,bestaetigen'],
    ['Einzelplatz offen', { rolleAus: true, steuerebeneOffen: true }, [], 'system,sicher,bestaetigen'],
    ['Einzelplatz eben aktiviert', { rolleAus: true, steuerebeneSicher: true }, ['steuerebeneAktiviert'], 'system,companion,neustart,bestaetigen'],
    ['Einzelplatz schon vorher sicher', { rolleAus: true, steuerebeneSicher: true }, [], 'system,companion,bestaetigen'],
    ['Einzelplatz nach dem erledigten Neustart', { rolleAus: true, steuerebeneSicher: true }, ['steuerebeneAktiviert', 'neustart:k5.neustart'],
      'system,companion,bestaetigen'],
    ['Rolle unbekannt eben aktiviert', { steuerebeneSicher: true }, ['steuerebeneAktiviert'], 'system,companion,neustart,bestaetigen'],
    ['Master sicher, eben aktiviert', { rolleMaster: true, steuerebeneSicher: true }, ['steuerebeneAktiviert'], 'verbund,bestaetigen'],
    ['Slave offen', { rolleSlave: true, steuerebeneOffen: true }, [], 'verbund,bestaetigen'],
  ];
  const k5Folge = (zst: Record<string, boolean>, evs: string[]): string =>
    geltendeSchritte(EINRICHTUNG, 'k5', zst, mit(evs, [])).map((s) => s.id.slice(3)).join(',');
  const k5Abw = K5.filter(([, zst, evs, soll]) => k5Folge(zst, evs) !== soll).map(([name, zst, evs]) => `${name}: ${k5Folge(zst, evs)}`);
  ck(`P6 5: Kapitel 5 je Rolle und Steuerebene: Token vor dem Neustart, Neustart nur nach dem Aktivieren, Bestätigung an jeder Rolle (${K5.length} Fälle)${k5Abw.length
    ? ` — ${k5Abw.join('; ')}` : ''}`, k5Abw.length === 0);

  // Hauptlauf an den Übergängen mit dem echten Kern (Spec 5, Gliederung 11 Regeln 4, 8, 11, EP7): Nach der Rollenwahl folgt am
  // Master die Kopplung („Kopplung erklärt“), am Slave das Koppeln. In Kapitel 5 kommen Token und QR vor dem Neustart (die
  // Karte zeigt das Token nur einmal), nach dem Neustart von selbst die Bestätigung; ohne sichere Steuerebene führt „Weiter“ hin.
  const lauf = (kapitel: string, schritt: string): AnleitungsFortschritt => ({
    ...leer, status: 'laeuft', position: { ort: 'kapitel', kapitel, schritt, nurZeigen: false, warErfuellt: false },
  });
  const ortVon = (f: AnleitungsFortschritt): string => (f.position === null ? 'kein Ort'
    : f.position.ort === 'kapitel' ? (f.position.schritt ?? `${f.position.kapitel}:erledigt`) : f.position.ort);
  const EINZEL_SICHER = { rolleAus: true, systemOffen: true, steuerebeneSicher: true };
  const f3 = anleitungSchritt(EINRICHTUNG, lauf('k5', 'k5.sicher'), { art: 'toolEreignis', name: 'steuerebeneAktiviert' }, EINZEL_SICHER, ZEIT);
  const f4 = anleitungSchritt(EINRICHTUNG, f3, { art: 'weiter' }, EINZEL_SICHER, ZEIT);
  const f5 = beimStart(EINRICHTUNG, { fortschritt: f4, zustand: 'ok' }, { bestehenderRechner: false }, ZEIT);
  const f6 = anleitungSchritt(EINRICHTUNG, f5.fortschritt, { art: 'option', index: 0 }, EINZEL_SICHER, ZEIT);
  const HAUPTLAUF: Array<[string, string, string]> = [
    ['Master: nach der Rollenwahl die Kopplung', ortVon(anleitungSchritt(EINRICHTUNG, lauf('k3', 'k3.rolle'), { art: 'zustand' },
      { verbundOffen: true, rolleMaster: true }, ZEIT)), 'k3.master'],
    ['Slave: nach der Rollenwahl das Koppeln', ortVon(anleitungSchritt(EINRICHTUNG, lauf('k3', 'k3.rolle'), { art: 'zustand' },
      { verbundOffen: true, rolleSlave: true }, ZEIT)), 'k3.slave'],
    ['Einzelplatz: nach dem Aktivieren Token und QR', ortVon(f3), 'k5.companion'],
    ['Einzelplatz: danach der verlangte Neustart', `${ortVon(f4)} ${f4.neustart?.schritt ?? '-'}`, 'k5.neustart k5.neustart'],
    ['nach dem Neustart: von selbst die Bestätigung', `${ortVon(f5.fortschritt)} ${f5.oeffnen}`, 'k5.bestaetigen anleitung'],
    ['Bestätigung: Kapitel 5 erledigt, weiter mit Kapitel 6', ortVon(f6), 'k6.oeffnen'],
    ['Einzelplatz offen: „Weiter“ führt zur Bestätigung', ortVon(anleitungSchritt(EINRICHTUNG, lauf('k5', 'k5.sicher'), { art: 'weiter' },
      { rolleAus: true, systemOffen: true, steuerebeneOffen: true }, ZEIT)), 'k5.bestaetigen'],
    ['nach dem Neustart: kein zweiter Neustart, „Weiter“ führt zur Bestätigung', ortVon(anleitungSchritt(EINRICHTUNG,
      { ...lauf('k5', 'k5.companion'), ereignisse: f5.fortschritt.ereignisse }, { art: 'weiter' }, EINZEL_SICHER, ZEIT)), 'k5.bestaetigen'],
    ['schon vorher sicher: kein Neustart', ortVon(anleitungSchritt(EINRICHTUNG, lauf('k5', 'k5.companion'), { art: 'weiter' },
      EINZEL_SICHER, ZEIT)), 'k5.bestaetigen'],
  ];
  const laufAbw = HAUPTLAUF.filter(([, ist, soll]) => ist !== soll).map(([name, ist]) => `${name}: ${ist}`);
  ck(`P6 5: Hauptlauf an den Übergängen mit dem echten Kern (${HAUPTLAUF.length} Fälle)${laufAbw.length ? ` — ${laufAbw.join('; ')}` : ''}`,
    laufAbw.length === 0);

  // Gesprochene Texte (Spec 6): 35 mit den IDs aus 9.1; noch kein eigener Sprechtext (erst nach der Hörprobe).
  const SPRECH_IDS = ['einleitung', 'rueckfrage', 'abschluss', 'k1.erledigt', 'k1.einstellungen', 'k1.zugang', 'k2.erledigt', 'k2.reiter',
    'k2.katalog', 'k2.installieren', 'k3.erledigt', 'k3.verbund', 'k3.allein', 'k3.oeffnen', 'k3.rolle', 'k3.master', 'k3.slave',
    'k4.erledigt', 'k4.reiter', 'k4.slave', 'k4.vorlage', 'k4.szenario', 'k4.name', 'k4.iveo', 'k4.speichern', 'k5.erledigt',
    'k5.system', 'k5.sicher', 'k5.neustart', 'k5.companion', 'k5.verbund', 'k5.bestaetigen', 'k6.erledigt', 'k6.master', 'k6.oeffnen'];
  const sprech = sprechTexte(EINRICHTUNG);
  const sprechIds = sprech.map((s) => s.id);
  const sprechFehlt = SPRECH_IDS.filter((id) => !sprechIds.includes(id));
  const sprechFremd = sprechIds.filter((id) => !SPRECH_IDS.includes(id));
  ck(`P6 6: 35 gesprochene Texte mit den IDs aus 9.1, jede genau einmal (${sprech.length})${sprechFehlt.length || sprechFremd.length
    ? ` — fehlt: ${sprechFehlt.join(', ')}; fremd: ${sprechFremd.join(', ')}` : ''}`,
    sprech.length === 35 && new Set(sprechIds).size === 35 && sprechFehlt.length === 0 && sprechFremd.length === 0);
  ck('P6 6: gesprochen wird der Text der Sprechblase, kein Schritt hat einen eigenen Sprechtext',
    schritte.every((s) => s.sprechtext === undefined)
    && sprech.every((s) => s.text === textVon(s.id.endsWith('.erledigt') ? `${s.id.slice(0, -'.erledigt'.length)}:erledigt` : s.id)));

  // Ziel-Kennungen (EP10): ZIEL_KENNUNGEN sind genau die Ziele der Anleitung.
  const ziele = [...new Set(schritte.flatMap((s) => (s.ziel ? [s.ziel] : [])))];
  ck(`P6 7: ZIEL_KENNUNGEN = die 20 Ziele der Anleitung, jede einmal, nach ZIEL_MUSTER (${ZIEL_KENNUNGEN.length})`,
    ZIEL_KENNUNGEN.length === 20 && new Set(ZIEL_KENNUNGEN).size === 20 && ZIEL_KENNUNGEN.every((k) => ZIEL_MUSTER.test(k))
    && [...ziele].sort().join(',') === [...ZIEL_KENNUNGEN].sort().join(','));

  // Launcher-Texte L1–L14 wörtlich (9.3).
  const L = LAUNCHER_ANLEITUNG_TEXTE;
  const LT: Array<[string, string, string]> = [
    ['L1', L.optionAllein, 'Ich arbeite allein an diesem Rechner'],
    ['L2', L.optionVerbund, 'Verbund einrichten'],
    ['L3', L.optionShowDa, 'Die Show ist da'],
    ['L4', L.optionCompanion, 'Companion ist verbunden'],
    ['L5 offen', L.aktion.k1(false), 'Einrichten'],
    ['L5 fertig', L.aktion.k1(true), 'Ändern'],
    ['L6 offen', L.aktion.k2(false), 'Auswählen'],
    ['L6 fertig', L.aktion.k2(true), 'Werkzeugkasten'],
    ['L7', L.aktion.k3, 'Verbund öffnen'],
    ['L8 k4', L.aktion.k4, 'Vorlage wählen'],
    ['L8 k5', L.aktion.k5, 'Prüfen'],
    ['L9 Proxy', L.detail.k1('proxy'), 'Aktiv: Firmen-Proxy.'],
    ['L9 GitHub', L.detail.k1('github'), 'Aktiv: GitHub.'],
    ['L10 eins', L.detail.k2(1), '1 Tool installiert, weitere jederzeit im Werkzeugkasten.'],
    ['L10 mehrere', L.detail.k2(3), '3 Tools installiert, weitere jederzeit im Werkzeugkasten.'],
    ['L11 Knopf', L.knopf, 'Erste Schritte'],
    ['L11 Titel', L.knopfTitel, 'Erste Schritte · geführte Einrichtung'],
    ['L12', L.neu, 'Neu: geführte Einrichtung'],
    ['L13 Titel', L.titel, 'Willkommen bei der JM Production Suite'],
    ['L13 Unterzeile', L.unterzeile, 'In sechs Schritten startklar. Jeden Schritt kannst du dir einzeln zeigen lassen.'],
    ['L14 Tipp', L.tipp, 'Tipp: Das JM Kochbuch (oben) hat Anleitungen & Best Practices.'],
    ['L14 Schließen', L.schliessen, 'Schließen'],
  ];
  const lAbw = LT.filter(([, ist, soll]) => ist !== soll).map(([nr]) => nr);
  ck(`P6 9.3: L1–L14 wörtlich (${LT.length} Texte)${lAbw.length ? ` — abweichend: ${lAbw.join(', ')}` : ''}`, lAbw.length === 0);
  const alleTexte: string[] = LT.map(([, t]) => t);
  const sammle = (x: unknown): void => {
    if (typeof x === 'string') alleTexte.push(x);
    else if (Array.isArray(x)) x.forEach(sammle);
    else if (x !== null && typeof x === 'object') Object.values(x).forEach(sammle);
  };
  sammle(EINRICHTUNG);
  const mitAscii = alleTexte.filter((t) => t.includes('"'));
  ck(`P6 G2: kein ASCII-Anführungszeichen in Anleitung und Launcher-Texten (${alleTexte.length} Zeichenketten)${mitAscii.length
    ? ` — ${mitAscii.join(' | ')}` : ''}`, mitAscii.length === 0);
  ck('P6 EP4: Schlüssel jmps:anleitung:einrichtung und jmps:anleitungStimme',
    ANLEITUNG_SCHLUESSEL === 'jmps:anleitung:einrichtung' && STIMME_SCHLUESSEL === 'jmps:anleitungStimme');
  const importe = quelleLf('../src/renderer/src/anleitung/einrichtung.ts').split('\n').filter((zeile) => /^import\b/.test(zeile));
  ck(`P6 G5: anleitung/einrichtung.ts lädt nur Typen (${importe.length} Import-Zeile, nur import type)`,
    importe.length >= 1 && importe.every((zeile) => zeile.startsWith('import type ')));
}

// --- Geführte Anleitungen P7 (Spec 7, 10; EP10): Ziel-Kennungen im Renderer, beidseitig gegen stillen Bruch -------------
// Jede Kennung der Anleitung steht genau einmal im Renderer (data-anleitung="…" oder Tabellenfeld anleitung: '…'), jede
// Kennung im Renderer gehört zur Anleitung, und sie sitzt in der Komponente des Kennungs-Registers (docs/anleitungen.md).
// Fällt eine Kennung beim Umbau weg (UX-Welle 3), wird dieser Block rot statt die Anleitung still ins Leere zu zeigen.
{
  const dateien = (readdirSync(new URL('../src/renderer/src/', import.meta.url), { recursive: true }) as string[])
    .map((d) => d.replace(/\\/g, '/')).filter((d) => d.endsWith('.tsx')).sort();
  const funde: Array<[string, string]> = [];
  const roh: string[] = [];
  for (const d of dateien) {
    const q = quelleLf(`../src/renderer/src/${d}`);
    for (const m of q.matchAll(/data-anleitung="([^"]*)"/g)) funde.push([m[1], d]);
    for (const m of q.matchAll(/\banleitung: '([a-z0-9-]+\.[^']*)'/g)) funde.push([m[1], d]);
    for (const m of q.matchAll(/data-anleitung=(?!"[^"]*"|\{\w+\.anleitung\})(\S{0,40})/g)) roh.push(`${d}: data-anleitung=${m[1]}`);
  }
  const anzahl = (k: string): number => funde.filter(([x]) => x === k).length;
  const fehlt = ZIEL_KENNUNGEN.filter((k) => anzahl(k) !== 1).map((k) => `${k} (${anzahl(k)}×)`);
  ck(`P7 7: jede der ${ZIEL_KENNUNGEN.length} Ziel-Kennungen steht genau einmal im Renderer${fehlt.length
    ? ` — fehlt oder mehrfach: ${fehlt.join(', ')}` : ''}`, ZIEL_KENNUNGEN.length === 20 && fehlt.length === 0);
  const fremd = funde.filter(([k]) => !ZIEL_KENNUNGEN.includes(k)).map(([k, d]) => `${k} in ${d}`);
  ck(`P7 7: jede Kennung im Renderer gehört zur Anleitung (${funde.length} gefunden)${fremd.length ? ` — fremd: ${fremd.join(', ')}` : ''}`,
    fremd.length === 0);
  ck(`P7 EP10: data-anleitung nur als Literal oder als Tabellenfeld x.anleitung, nie zusammengesetzt${roh.length ? ` — ${roh.join(', ')}` : ''}`,
    roh.length === 0);
  ck('P7 EP10: die Tabellenfelder werden gerendert (TabBar tab.anleitung, ShowView action.anleitung)',
    quelleLf('../src/renderer/src/components/TabBar.tsx').includes('data-anleitung={tab.anleitung}')
    && quelleLf('../src/renderer/src/components/ShowView.tsx').includes('data-anleitung={action.anleitung}'));
  // Kennungs-Register (Gliederung 13 P7, docs/anleitungen.md): Kennung → Komponente.
  const ORT: Record<string, string> = {
    'kopf.erste-schritte': 'components/Header.tsx',
    'kopf.einstellungen': 'components/Header.tsx',
    'kopf.system': 'components/Header.tsx',
    'kopf.show-oeffnen': 'components/Header.tsx',
    'kopf.verbund': 'components/VerbundBadge.tsx',
    'einstellungen.zugang': 'components/SettingsModal.tsx',
    'reiter.werkzeugkasten': 'components/TabBar.tsx',
    'reiter.show': 'components/TabBar.tsx',
    'werkzeugkasten.kategorien': 'components/ToolboxView.tsx',
    'werkzeugkasten.installieren': 'components/ToolCard.tsx',
    'verbund.rollen': 'components/VerbundModal.tsx',
    'verbund.koppeln-master': 'components/VerbundMaster.tsx',
    'verbund.code': 'components/VerbundSlave.tsx',
    'show.vorlage': 'components/ShowView.tsx',
    'szenario.auswahl': 'components/ScenarioPicker.tsx',
    'editor.name': 'components/ShowEditorModal.tsx',
    'editor.iveo': 'components/ShowEditorModal.tsx',
    'editor.speichern': 'components/ShowEditorModal.tsx',
    'system.steuerebene': 'components/SystemStatusModal.tsx',
    'system.sicher': 'components/SystemStatusModal.tsx',
  };
  const falscherOrt = ZIEL_KENNUNGEN.filter((k) => !funde.some(([x, d]) => x === k && d === ORT[k])).map((k) => `${k} (soll ${ORT[k]})`);
  ck(`P7 7: jede Kennung sitzt in der Komponente des Kennungs-Registers${falscherOrt.length ? ` — ${falscherOrt.join(', ')}` : ''}`,
    Object.keys(ORT).length === 20 && falscherOrt.length === 0);
}

// --- Geführte Anleitungen P8 (Spec 5, 7, 8; EP5, EP6, EP17, G7): Zustands-Adapter Store → Bedingungen ----------------
// Kreuzprodukte mit eigener Erwartung je Fall (aus den Fall-Namen, nicht aus dem Adapter): Ein Haken entsteht nur aus einem
// echten Zustand; Quelle null/'none', Verbund-Stand null, Dateifehler (Rolle unbekannt) und Steuerebene null zählen nie.
{
  const eingang = (teil: Partial<AnleitungsEingang>): AnleitungsEingang => ({
    settings: null, states: {}, view: 'catalog', settingsOpen: false, systemOpen: false, scenariosOpen: false, showEditorOpen: false,
    verbundOffen: false, verbund: null, steuerebene: null, recentShows: 0, laufendeTools: 0, showLaunch: false, iveoActive: false,
    ...teil,
  });
  const stand = (rolle: string, dateiFehler: string | null, gekoppelt: boolean, art: string): VerbundStand => ({
    rolle, rechnerName: 'Regie 1', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler, master: null,
    slave: { gekoppelt, koppeltGerade: false, masterName: 'Master', festeAdresse: null, client: { art }, gefundeneMaster: [] },
  }) as VerbundStand;
  const NAMEN = ['quelleVerbunden', 'toolInstalliert', 'reiterWerkzeugkasten', 'reiterShow', 'einstellungenOffen', 'systemOffen',
    'verbundOffen', 'szenarienOffen', 'editorOffen', 'rolleAus', 'rolleMaster', 'rolleSlave', 'slaveGekoppelt', 'slaveVerbunden',
    'steuerebeneSicher', 'steuerebeneOffen', 'showGestartet'];
  ck('P8 10.3: Namenslisten nach Gliederung 10.3 (17 Zustände, 3 Ereignisse, 3 Entscheidungen)',
    ZUSTANDS_NAMEN.join(',') === NAMEN.join(',') && EREIGNIS_NAMEN.join(',') === 'showGespeichert,slaveWarVerbunden,steuerebeneAktiviert'
    && ENTSCHEIDUNGS_NAMEN.join(',') === 'allein,companionVerbunden,showVomMaster');
  const vergleiche = (fall: string, ist: Record<string, boolean>, soll: Record<string, boolean>, abw: string[]): void => {
    for (const n of NAMEN) if (ist[n] !== soll[n]) abw.push(`${fall}: ${n} ist ${String(ist[n])}`);
  };

  // Kreuz 1: Quelle × Verbund-Stand × gekoppelt × Client × Steuerebene
  const QUELLEN = [null, 'none', 'proxy', 'github'] as const;
  const STAENDE = ['null', 'aus', 'master', 'slave', 'aus+dateiFehler', 'master+dateiFehler', 'slave+dateiFehler'] as const;
  const CLIENTS = ['verbunden', 'sucht', 'fehler'] as const;
  const STEUER = [null, 'open', 'secure'] as const;
  let n1 = 0;
  const abw1: string[] = [];
  for (const q of QUELLEN) for (const st of STAENDE) for (const gek of [false, true]) for (const art of CLIENTS) for (const se of STEUER) {
    n1++;
    const [rolle, fehler] = st.split('+');
    const e = eingang({
      settings: q === null ? null : { source: q },
      verbund: st === 'null' ? null : stand(rolle, fehler ? 'EACCES' : null, gek, art),
      steuerebene: se,
    });
    const soll: Record<string, boolean> = {
      quelleVerbunden: q === 'proxy' || q === 'github', toolInstalliert: false, reiterWerkzeugkasten: true, reiterShow: false,
      einstellungenOffen: false, systemOffen: false, verbundOffen: false, szenarienOffen: false, editorOffen: false,
      rolleAus: st === 'aus', rolleMaster: st === 'master', rolleSlave: st === 'slave', slaveGekoppelt: st === 'slave' && gek,
      slaveVerbunden: st === 'slave' && gek && art === 'verbunden', steuerebeneSicher: se === 'secure', steuerebeneOffen: se === 'open',
      showGestartet: false,
    };
    vergleiche(`${q}/${st}/${gek ? 'gekoppelt' : 'frei'}/${art}/${se}`, anleitungsZustand(e), soll, abw1);
  }
  ck(`P8 G7: Kreuz Quelle × Verbund-Stand × gekoppelt × Client × Steuerebene, eine Voreinstellung zählt nie (${n1} Fälle)${abw1.length
    ? ` — ${abw1.slice(0, 5).join('; ')}` : ''}`, n1 === 504 && abw1.length === 0);

  // Kreuz 2: Werkzeuge × Reiter × Shows × fünf Dialoge
  const STATES: Array<[string, Record<string, { status: string }>, boolean]> = [
    ['keine', {}, false],
    ['nicht installiert', { 'jm-timer': { status: 'not-installed' } }, false],
    ['installiert', { 'jm-timer': { status: 'installed' } }, true],
    ['Update', { 'jm-timer': { status: 'update-available' } }, true],
    ['gemischt', { 'jm-timer': { status: 'not-installed' }, 'jm-titler': { status: 'update-available' } }, true],
  ];
  let n2 = 0;
  const abw2: string[] = [];
  for (const [sn, states, inst] of STATES) for (const view of ['catalog', 'jmshow'] as const) for (const recent of [0, 1, 3])
    for (let maske = 0; maske < 32; maske++) {
      n2++;
      const b = (i: number): boolean => (maske & (1 << i)) !== 0;
      const e = eingang({ states, view, recentShows: recent, settingsOpen: b(0), systemOpen: b(1), scenariosOpen: b(2), showEditorOpen: b(3), verbundOffen: b(4) });
      const soll: Record<string, boolean> = {
        quelleVerbunden: false, toolInstalliert: inst, reiterWerkzeugkasten: view === 'catalog', reiterShow: view === 'jmshow',
        einstellungenOffen: b(0), systemOffen: b(1), szenarienOffen: b(2), editorOffen: b(3), verbundOffen: b(4),
        rolleAus: false, rolleMaster: false, rolleSlave: false, slaveGekoppelt: false, slaveVerbunden: false, steuerebeneSicher: false,
        steuerebeneOffen: false, showGestartet: recent > 0,
      };
      vergleiche(`${sn}/${view}/${recent}/${maske}`, anleitungsZustand(e), soll, abw2);
    }
  ck(`P8 5: Kreuz Werkzeuge × Reiter × Shows × Dialoge, installiert wie die Checkliste (${n2} Fälle)${abw2.length
    ? ` — ${abw2.slice(0, 5).join('; ')}` : ''}`, n2 === 960 && abw2.length === 0);

  // Frischer Rechner über Adapter und Kern: kein Kapitel erledigt (Review Focus 1).
  const leer = leererFortschritt('einrichtung');
  const FRISCH: Array<[string, AnleitungsEingang]> = [
    ['nichts geladen', eingang({})],
    ['Voreinstellungen geladen', eingang({ settings: { source: 'none' }, verbund: stand('aus', null, false, 'aus'), steuerebene: 'open',
      states: { 'jm-timer': { status: 'not-installed' } } })],
  ];
  const frischAbw = FRISCH.flatMap(([name, e]) => EINRICHTUNG.kapitel
    .filter((k) => kapitelZustand(EINRICHTUNG, k.id, anleitungsZustand(e), leer) !== 'offen').map((k) => `${name}: ${k.id}`));
  ck(`P8 G7: frischer Rechner (nichts geladen bzw. nur Voreinstellungen) → alle sechs Kapitel offen${frischAbw.length
    ? ` — ${frischAbw.join(', ')}` : ''}`, frischAbw.length === 0);

  // Produktion (Spec 7, EP17, OFP4): Tool läuft, Show startet, iveo-Show offen (auch ohne laufendes Tool: der Main setzt
  // iveoActive erst mit einer Show ohne iveo zurück) oder am Master folgen Tools anderer Rechner der verteilten Show.
  const masterStand = (showName: string | null, bezieher: number): VerbundStand => ({
    rolle: 'master', rechnerName: 'Regie 1', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null, slave: null,
    master: {
      zustand: 'laeuft', fehlerCode: null, name: 'Master', fpKurz: 'AB12', ausBak: false, speicherFehler: null, rechner: [],
      kopplung: { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false },
      showImVerbund: { grund: showName === null ? 'keine-show' : null, showName, dateiName: null, verteiltAm: null, groesseKiB: null, bezieher },
    },
  }) as VerbundStand;
  const VERBUENDE: Array<[string, VerbundStand | null, boolean]> = [
    ['kein Stand', null, false],
    ['Master ohne Show', masterStand(null, 0), false],
    ['Master, Show ohne Bezieher', masterStand('Konferenz', 0), false],
    ['Master, Show mit Bezieher', masterStand('Konferenz', 2), true],
    ['Slave', stand('slave', null, true, 'verbunden'), false],
  ];
  let n3 = 0;
  const abw3: string[] = [];
  for (const laufend of [0, 1, 3]) for (const launch of [false, true]) for (const iveo of [false, true]) for (const [vn, v, folgt] of VERBUENDE) {
    n3++;
    const ist = produktionLaeuft(eingang({ laufendeTools: laufend, showLaunch: launch, iveoActive: iveo, verbund: v }));
    if (ist !== (laufend > 0 || launch || iveo || folgt)) abw3.push(`${laufend}/${launch}/${iveo}/${vn}`);
  }
  ck(`P8 7: Produktion = Tool läuft, Show startet, iveo-Show offen (auch ohne laufendes Tool) oder am Master folgen Tools der verteilten Show (${n3} Fälle)${abw3.length
    ? ` — ${abw3.join(', ')}` : ''}`, n3 === 60 && abw3.length === 0);

  // Detailzeilen L9, L10 (nur mit Daten)
  const D = LAUNCHER_ANLEITUNG_TEXTE.detail;
  const DETAILS: Array<[string, AnleitungsEingang, string]> = [
    ['nichts geladen', eingang({}), '{}'],
    ['Quelle none', eingang({ settings: { source: 'none' } }), '{}'],
    ['Proxy', eingang({ settings: { source: 'proxy' } }), '{"k1":"Aktiv: Firmen-Proxy."}'],
    ['GitHub', eingang({ settings: { source: 'github' } }), '{"k1":"Aktiv: GitHub."}'],
    ['nur nicht installiert', eingang({ states: { 'jm-timer': { status: 'not-installed' } } }), '{}'],
    ['ein Tool', eingang({ states: { 'jm-timer': { status: 'installed' } } }), '{"k2":"1 Tool installiert, weitere jederzeit im Werkzeugkasten."}'],
    ['zwei Tools mit Update', eingang({ settings: { source: 'proxy' }, states: { 'jm-timer': { status: 'installed' },
      'jm-titler': { status: 'update-available' }, 'jm-rundown': { status: 'not-installed' } } }),
    '{"k1":"Aktiv: Firmen-Proxy.","k2":"2 Tools installiert, weitere jederzeit im Werkzeugkasten."}'],
  ];
  const detAbw = DETAILS.filter(([, e, soll]) => JSON.stringify(kapitelDetails(e, D)) !== soll)
    .map(([name, e]) => `${name}: ${JSON.stringify(kapitelDetails(e, D))}`);
  ck(`P8 9.3: Detailzeilen L9, L10 nur mit Daten, Einzahl und Mehrzahl (${DETAILS.length} Fälle)${detAbw.length ? ` — ${detAbw.join('; ')}` : ''}`,
    detAbw.length === 0);

  // Ereignisse genau beim Übergang (EP5): „Slave war verbunden“ und „Steuerebene aktiviert“ (offen → sicher in dieser Sitzung;
  // eine schon beim ersten Lesen sichere oder vorher nicht geladene Steuerebene zählt nicht, Kapitel 5 verlangt dann keinen Neustart)
  const W = '2026-10-19T10:00:00.000Z';
  const UEBERGANG: Array<[string, Record<string, boolean> | null, Record<string, boolean>, Record<string, string>, string]> = [
    ['erster Blick, verbunden', null, { slaveVerbunden: true }, {}, 'slaveWarVerbunden'],
    ['Übergang nicht → verbunden', { slaveVerbunden: false }, { slaveVerbunden: true }, {}, 'slaveWarVerbunden'],
    ['bleibt verbunden', { slaveVerbunden: true }, { slaveVerbunden: true }, {}, ''],
    ['schon gemerkt', null, { slaveVerbunden: true }, { slaveWarVerbunden: W }, ''],
    ['nicht verbunden', { slaveVerbunden: false }, { slaveVerbunden: false }, {}, ''],
    ['Verbindung weg', { slaveVerbunden: true }, { slaveVerbunden: false }, {}, ''],
    ['Steuerebene offen → sicher', { steuerebeneOffen: true }, { steuerebeneSicher: true }, {}, 'steuerebeneAktiviert'],
    ['Steuerebene beim ersten Blick sicher', null, { steuerebeneSicher: true }, {}, ''],
    ['Steuerebene nicht geladen → sicher', { steuerebeneOffen: false, steuerebeneSicher: false }, { steuerebeneSicher: true }, {}, ''],
    ['Steuerebene bleibt sicher (Erneuern)', { steuerebeneSicher: true }, { steuerebeneSicher: true }, {}, ''],
    ['Steuerebene offen → sicher, schon gemerkt', { steuerebeneOffen: true }, { steuerebeneSicher: true }, { steuerebeneAktiviert: W }, ''],
    ['beides zugleich', { steuerebeneOffen: true }, { slaveVerbunden: true, steuerebeneSicher: true }, {}, 'slaveWarVerbunden,steuerebeneAktiviert'],
  ];
  const uebAbw = UEBERGANG.filter(([, v, j, g, soll]) => neueToolEreignisse(v, j, g).join(',') !== soll).map(([name]) => name);
  ck(`P8 5: Ereignisse genau beim Übergang und nur, wenn noch nicht gemerkt (slaveWarVerbunden, steuerebeneAktiviert; ${UEBERGANG.length} Fälle)${uebAbw.length
    ? ` — ${uebAbw.join('; ')}` : ''}`, uebAbw.length === 0);

  const quelleAdapter = quelleLf('../src/renderer/src/lib/anleitung-zustand.ts');
  const importe = quelleAdapter.split('\n').filter((zeile) => /^import\b/.test(zeile));
  ck(`P8 G3/G5: lib/anleitung-zustand.ts lädt nur Typen und liest nichts selbst (${importe.length} Import-Zeile, kein window, kein localStorage)`,
    importe.length >= 1 && importe.every((zeile) => zeile.startsWith('import type ')) && !/\bwindow\b|localStorage/.test(quelleAdapter));
}

// --- Geführte Anleitungen P9 · Stimme: Manifest, Prüfsummen, „zu jedem Text eine Ansage“ (Spec 6; EP12–EP14, EP21) ----
// Läuft ohne Piper und ohne ffmpeg, auch in der CI: verglichen werden die Text-Prüfsummen im Manifest mit den gesprochenen
// Texten der Anleitung und die Datei-Prüfsummen mit den .ogg im Ordner. Ändert sich ein gesprochener Text, bleibt die
// Repo-Prüfung rot, bis seine Ansage neu erzeugt ist (G2). Alle Module kommen per import() in diesem Block: so stößt
// keine Importzeile mit denen anderer Aufgaben zusammen (P6 importiert sprechTexte und EINRICHTUNG schon oben).
await (async () => {
  const { leeresManifest, leseOrdner, manifestText, pruefeStimme, STIMMEN, textSha256 } = await import('../scripts/stimme-manifest.mjs');
  const { sprechTexte } = await import('@jm/ui/anleitung');
  const { EINRICHTUNG } = await import('../src/renderer/src/anleitung/einrichtung.ts');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const json = (x: unknown): string => JSON.stringify(x);

  ck('P9 6 EP13: textSha256 ist SHA-256 über UTF-8 (abc → ba7816bf…)',
    textSha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  ck('P9 6 EP13: textSha256 über NFC — „Grüße“ als NFD ergibt dieselbe Prüfsumme wie als NFC',
    'Grüße' !== 'Grüße' && textSha256('Grüße') === textSha256('Grüße'));
  ck('P9 6 EP13: CRLF statt LF ist ein anderer Text', textSha256('a\r\nb') !== textSha256('a\nb'));
  const leer1 = leeresManifest();
  leer1.eintraege.push({ id: 'x' } as never);
  ck('P9 EP14: leeresManifest = format 1, stimme/werkzeug/parameter null, eintraege leer; jedes Mal ein neues Objekt',
    json(leeresManifest()) === '{"format":1,"stimme":null,"werkzeug":null,"parameter":null,"eintraege":[]}');
  ck('P9 G12: manifestText = JSON mit zwei Leerzeichen, LF und Schluss-LF',
    manifestText(leeresManifest()) === '{\n  "format": 1,\n  "stimme": null,\n  "werkzeug": null,\n  "parameter": null,\n  "eintraege": []\n}\n');
  ck('P9 OFP1: STIMMEN pinnt genau de_DE-mls-medium (69cd1d2a…53f65bf, CC BY 4.0) und de_DE-thorsten-medium (7e64762d…bb7819, CC0)',
    json(Object.keys(STIMMEN)) === '["de_DE-mls-medium","de_DE-thorsten-medium"]'
    && STIMMEN['de_DE-mls-medium'].onnxSha256 === '69cd1d2aa5a35839a518966fcc4924b5f93e5f8c948ed0752b1a616ad53f65bf'
    && STIMMEN['de_DE-mls-medium'].lizenz === 'CC BY 4.0'
    && STIMMEN['de_DE-thorsten-medium'].onnxSha256 === '7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819'
    && STIMMEN['de_DE-thorsten-medium'].lizenz === 'CC0'
    && Object.values(STIMMEN).every((s) => s.namensnennung.length > 0 && !s.namensnennung.includes('"')));

  // pruefeStimme: eine Tabelle, je Fall eine Zeile (Fixtures nur im Speicher, keine erfundenen Audiodateien).
  type Text = { id: string; text: string };
  type Datei = { name: string; sha256: string };
  const TEXTE: Text[] = [
    { id: 'einleitung', text: 'Willkommen. Ich führe dich durch die Einrichtung.' },
    { id: 'k1.zugang', text: 'Trage hier den Zugang ein und klicke auf „Speichern“.' },
    { id: 'k2.erledigt', text: 'Auf diesem Rechner ist schon ein Tool installiert.' },
  ];
  const DATEIEN: Datei[] = TEXTE.map((t, i) => ({ name: `${t.id}.ogg`, sha256: String(i + 1).repeat(64) }));
  const pin = STIMMEN['de_DE-mls-medium'];
  const voll = () => ({
    format: 1 as number,
    stimme: { name: 'de_DE-mls-medium', onnxSha256: pin.onnxSha256, lizenz: pin.lizenz, namensnennung: pin.namensnennung, sprecher: 3 as number | null },
    werkzeug: { piper: '1.8.0', ffmpeg: '8.1.2' } as { piper: string; ffmpeg: string } | null,
    parameter: { lengthScale: 1.05, sentenceSilence: 0.3, opusKbps: 24 } as { lengthScale: number; sentenceSilence: number; opusKbps: number } | null,
    eintraege: TEXTE.map((t, i) => ({ id: t.id, textSha256: textSha256(t.text), datei: `${t.id}.ogg`, dateiSha256: DATEIEN[i].sha256, bytes: 1000 })),
  });
  const mit = <T>(x: T, f: (y: T) => void): T => { f(x); return x; };
  const faelle: Array<{ name: string; texte: Text[]; manifest: unknown; dateien: Datei[]; erwartet: string[] }> = [
    { name: 'stimmig ohne Stimme (leeres Manifest, keine Datei)', texte: TEXTE, manifest: leeresManifest(), dateien: [], erwartet: [] },
    { name: 'stimmig mit Stimme', texte: TEXTE, manifest: voll(), dateien: DATEIEN, erwartet: [] },
    { name: 'Text um ein Zeichen geändert', texte: TEXTE.map((t) => (t.id === 'einleitung' ? { ...t, text: 'Willkommen! Ich führe dich durch die Einrichtung.' } : t)), manifest: voll(), dateien: DATEIEN, erwartet: ['Text geändert: einleitung'] },
    { name: 'Text in NFD statt NFC ist derselbe Text', texte: TEXTE.map((t) => ({ ...t, text: t.text.normalize('NFD') })), manifest: voll(), dateien: DATEIEN, erwartet: [] },
    { name: 'Datei gelöscht', texte: TEXTE, manifest: voll(), dateien: DATEIEN.filter((d) => d.name !== 'k1.zugang.ogg'), erwartet: ['Datei fehlt: k1.zugang.ogg'] },
    { name: 'Datei mit anderer Prüfsumme', texte: TEXTE, manifest: voll(), dateien: DATEIEN.map((d) => (d.name === 'k1.zugang.ogg' ? { ...d, sha256: 'f'.repeat(64) } : d)), erwartet: ['Prüfsumme falsch: k1.zugang.ogg'] },
    { name: 'fremde Datei dazugelegt', texte: TEXTE, manifest: voll(), dateien: [...DATEIEN, { name: 'fremd.ogg', sha256: '9'.repeat(64) }], erwartet: ['Datei ohne Text: fremd.ogg'] },
    { name: 'Text gestrichen (Eintrag und Datei bleiben übrig)', texte: TEXTE.slice(0, 2), manifest: voll(), dateien: DATEIEN, erwartet: ['Eintrag ohne Text: k2.erledigt', 'Datei ohne Text: k2.erledigt.ogg'] },
    { name: 'neuer Text ohne Ansage', texte: [...TEXTE, { id: 'k3.neu', text: 'Neu.' }], manifest: voll(), dateien: DATEIEN, erwartet: ['Ansage fehlt: k3.neu'] },
    { name: 'Stimme mit fremder Prüfsumme', texte: TEXTE, manifest: mit(voll(), (m) => { m.stimme.onnxSha256 = '0'.repeat(64); }), dateien: DATEIEN, erwartet: ['Stimme nicht gepinnt: de_DE-mls-medium'] },
    { name: 'Stimme ohne Pin (de_DE-karlsson-low)', texte: TEXTE, manifest: mit(voll(), (m) => { m.stimme.name = 'de_DE-karlsson-low'; }), dateien: DATEIEN, erwartet: ['Stimme nicht gepinnt: de_DE-karlsson-low'] },
    { name: 'Namensnennung weicht vom Pin ab', texte: TEXTE, manifest: mit(voll(), (m) => { m.stimme.namensnennung = 'Stimme: unbekannt'; }), dateien: DATEIEN, erwartet: ['Lizenz oder Namensnennung weicht vom Pin ab: de_DE-mls-medium'] },
    { name: 'Sprecher -1', texte: TEXTE, manifest: mit(voll(), (m) => { m.stimme.sprecher = -1; }), dateien: DATEIEN, erwartet: ['Sprecher ungültig: -1'] },
    { name: 'ohne Stimme mit Dateien', texte: TEXTE, manifest: leeresManifest(), dateien: DATEIEN, erwartet: ['Ohne Stimme darf es keine Datei geben: einleitung.ogg', 'Ohne Stimme darf es keine Datei geben: k1.zugang.ogg', 'Ohne Stimme darf es keine Datei geben: k2.erledigt.ogg'] },
    { name: 'ohne Stimme mit Einträgen', texte: TEXTE, manifest: { ...leeresManifest(), eintraege: voll().eintraege }, dateien: [], erwartet: ['Ohne Stimme darf es keinen Eintrag geben: einleitung', 'Ohne Stimme darf es keinen Eintrag geben: k1.zugang', 'Ohne Stimme darf es keinen Eintrag geben: k2.erledigt'] },
    { name: 'ohne Stimme, aber mit Parametern', texte: TEXTE, manifest: { ...leeresManifest(), parameter: voll().parameter }, dateien: [], erwartet: ['Ohne Stimme müssen werkzeug und parameter null sein'] },
    { name: 'Eintrag doppelt', texte: TEXTE, manifest: mit(voll(), (m) => { m.eintraege.push({ ...m.eintraege[0] }); }), dateien: DATEIEN, erwartet: ['Eintrag doppelt: einleitung'] },
    { name: 'Dateiname passt nicht zur ID', texte: TEXTE, manifest: mit(voll(), (m) => { m.eintraege[0].datei = 'Einleitung.ogg'; }), dateien: DATEIEN, erwartet: ['Dateiname falsch: einleitung (Einleitung.ogg)', 'Datei ohne Text: einleitung.ogg'] },
    { name: 'mit Stimme ohne Parameter', texte: TEXTE, manifest: mit(voll(), (m) => { m.parameter = null; }), dateien: DATEIEN, erwartet: ['Parameter fehlen im Manifest (lengthScale, sentenceSilence, opusKbps)'] },
    { name: 'mit Stimme ohne Werkzeug', texte: TEXTE, manifest: mit(voll(), (m) => { m.werkzeug = null; }), dateien: DATEIEN, erwartet: ['Werkzeug fehlt im Manifest (piper, ffmpeg)'] },
    { name: 'Manifest-Format 2', texte: TEXTE, manifest: mit(voll(), (m) => { m.format = 2; }), dateien: DATEIEN, erwartet: ['Manifest-Format unbekannt: 2'] },
    { name: 'kein Manifest (null)', texte: TEXTE, manifest: null, dateien: [], erwartet: ['Manifest unlesbar: erwartet ein Objekt mit der Liste eintraege'] },
  ];
  for (const f of faelle) {
    const ist = pruefeStimme(f.texte, f.manifest, f.dateien);
    ck(`P9 6: pruefeStimme, ${f.name} → ${f.erwartet.length ? f.erwartet.join(' | ') : 'keine Befunde'}`, json(ist) === json(f.erwartet));
    if (json(ist) !== json(f.erwartet)) console.log(`      ist ${json(ist)}`);
  }

  // Repo: das echte Manifest gegen die echten Texte und die echten Dateien im Ordner.
  const ordner = fileURLToPath(new URL('../src/renderer/src/anleitung/stimme/', import.meta.url));
  const texte = sprechTexte(EINRICHTUNG);
  const manifestPfad = `${ordner}manifest.json`;
  const roh = existsSync(manifestPfad) ? readFileSync(manifestPfad, 'utf8').replace(/\r\n/g, '\n') : '';
  let manifest: unknown = null;
  try { manifest = JSON.parse(roh); } catch { manifest = null; }
  const inhalt = leseOrdner(ordner);
  const befunde = pruefeStimme(texte, manifest, inhalt.ogg);
  const stimmeName = (manifest as { stimme?: { name?: string } | null } | null)?.stimme?.name ?? 'keine';
  ck(`P9 6: Repo — manifest.json passt zu den ${texte.length} gesprochenen Texten und den ${inhalt.ogg.length} .ogg im Ordner (Stimme: ${stimmeName})`,
    befunde.length === 0 && roh.length > 0);
  for (const b of befunde) console.log(`      ${b}`);
  ck('P9 G12: manifest.json ist genau manifestText seines Inhalts (zwei Leerzeichen, Schluss-LF; verglichen nach LF)',
    manifest !== null && roh === manifestText(manifest));
  ck('P9 G14: im Stimmen-Ordner liegen nur manifest.json, HERKUNFT.md und .ogg (keine WAV, keine Stimme, kein Text)',
    json(inhalt.andere) === '["HERKUNFT.md","manifest.json"]');
  if (json(inhalt.andere) !== '["HERKUNFT.md","manifest.json"]') console.log(`      andere Dateien: ${json(inhalt.andere)}`);
  const herkunftPfad = `${ordner}HERKUNFT.md`;
  const herkunftRoh = existsSync(herkunftPfad) ? readFileSync(herkunftPfad, 'utf8').replace(/\r\n/g, '\n') : '';
  const herkunft = herkunftRoh.replace(/\s+/g, ' ');
  const gewaehlt = (herkunftRoh.split('\n## Gewählte Stimme\n')[1] ?? '').split('\n## ')[0];
  const entscheid = gewaehlt.split('\n').find((z) => z.startsWith('Owner-Entscheidung OFP1 vom ')) ?? '';
  ck(`P9 6 OFP1: HERKUNFT.md „Gewählte Stimme“ passt zum Manifest (Stimme: ${stimmeName})`,
    gewaehlt.length > 0 && (stimmeName === 'keine'
      ? gewaehlt.includes('Noch offen (Owner-Frage OFP1)') || entscheid.includes('ohne Ton')
      : entscheid.includes(`\`${stimmeName}\``) && !gewaehlt.includes('Noch offen (Owner-Frage OFP1)')));
  ck('P9 6 EP21: HERKUNFT.md nennt beide Kandidaten mit Pin und Lizenz, das lessac-Erbe, die Werkzeuge nur beim Bau, OFP1 und beide Namensnennungen wörtlich',
    Object.values(STIMMEN).every((s) => herkunft.includes(s.onnxSha256) && herkunft.includes(s.namensnennung))
    && herkunft.includes('„License: CC-BY 4.0“') && herkunft.includes('„License: CC0“')
    && herkunft.includes('Finetuned from U.S. English lessac voice') && herkunft.includes('nur beim Bau')
    && herkunft.includes('OFP1') && !herkunft.includes('"'));
})();

// --- Geführte Anleitungen P11 · Ansagen im Renderer, Vite ohne data:audio (Spec 6; EP15; G4) --------------------------
// Lehre „eine CSP-Lücke legt nur den Installer lahm“: Vite legt Dateien unter 4 KB als data: ins JS, die CSP des Launchers
// erlaubt media-src aber nur 'self' blob:. Im Dev-Server spielt alles, im Installer bliebe eine kurze Ansage stumm. Die
// Regel steht in electron.vite.config.ts; npm run stimme:bau-pruefen prüft den echten Bau (P11 Step 10, P18).
await (async () => {
  const { buildCsp } = await import('../../../packages/app-runtime/src/csp.ts');
  const vite = quelleLf('../electron.vite.config.ts');
  const stimme = quelleLf('../src/renderer/src/anleitung/stimme.ts');
  const html = quelleLf('../src/renderer/index.html');
  const haupt = quelleLf('../src/main/index.ts');
  const paket = JSON.parse(quelleLf('../package.json')) as { scripts: Record<string, string> };
  const regel = "      assetsInlineLimit: (datei: string) => (/\\.(ogg|opus|webm|mp3|wav)$/i.test(datei) ? false : undefined),";
  const iRenderer = vite.indexOf('\n  renderer: {');
  const iRegel = vite.indexOf(`\n${regel}\n`);
  const iEingabe = vite.indexOf("        input: { index: resolve(__dirname, 'src/renderer/index.html') },");
  ck('P11 6 EP15: renderer.build hat assetsInlineLimit mit der Audio-Regel (ogg, opus, webm, mp3, wav → nie data:), genau einmal',
    iRenderer > 0 && iRegel > iRenderer && iRegel < iEingabe && vite.split('assetsInlineLimit').length === 2);
  ck('P11 6 EP15: stimme.ts lädt die Ansagen über import.meta.glob mit query ?url (als Datei, Muster tool-icons.ts) und das Manifest per JSON-Import',
    stimme.includes("import.meta.glob<string>('./stimme/*.ogg', { eager: true, query: '?url', import: 'default' })")
    && stimme.includes("import manifestRoh from './stimme/manifest.json';")
    && /export function ansageUrl\(id: string\): string \| null/.test(stimme)
    && stimme.includes('export const STIMME_VORHANDEN: boolean = manifest.stimme !== null;')
    && stimme.includes('export const NAMENSNENNUNG: string | null = manifest.stimme?.namensnennung ?? null;'));
  ck('P11 6 G4: die CSP bleibt — der Launcher setzt sie als Header (csp: true), index.html hat keine Meta-CSP ohne media-src \'self\'',
    haupt.includes('initAppRuntime({ csp: true,')
    && (!/http-equiv=["']Content-Security-Policy/i.test(html) || /media-src[^;"]*'self'/.test(html)));
  ck('P11 6 G4: media-src im Paket ist genau \'self\' blob: (kein data:) — darum dürfen Ansagen nie eingebettet werden',
    buildCsp({}, false).split('; ').includes("media-src 'self' blob:"));
  ck('P11 6 EP15: Skript stimme:bau-pruefen = node scripts/pruefe-bau-stimme.mjs',
    paket.scripts['stimme:bau-pruefen'] === 'node scripts/pruefe-bau-stimme.mjs');
})();

// --- Geführte Anleitung, Block D (P12–P15): Hilfen für Treiber-Tests und Quelltext-Wächter --------------------------------
// Die Logik des Stores läuft hier echt: als reiner Treiber (lib/anleitung-zustand.ts) mit dem echten Ablaufkern und
// Attrappen. Store, Overlay und Komponenten laden zustand, React und window.jmps und laufen hier nicht; geprüft wird ihr
// Quelltext (Muster P31 und M1).
/** Quelltext nach LF; fehlt die Datei (Rot-Lauf vor dem Anlegen), leer statt Absturz. */
function quelleLfOderLeer(pfad: string): string {
  try {
    return quelleLf(pfad);
  } catch {
    return '';
  }
}
/** Ohne Kommentare: ein Wächter prüft Code, nicht Erklärungen (ein Kommentar darf „openShow“ nennen). */
function ohneKommentare(q: string): string {
  return q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}
/**
 * G3 (Spec 2 Anti-Ziel, 7): Namen, mit denen Anleitungs-Code etwas bedienen, starten oder einen Dialog öffnen würde — die
 * Liste der Gliederung, dazu `open` (startet ein Tool) und die Dialog-Öffner des Launchers.
 */
const G3_NAMEN = ['openShow', 'openShowPath', 'install', 'update', 'updateAll', 'uninstall', 'updateLauncher', 'saveShow',
  'saveSettings', 'provisionControl', 'disableControl', 'checkUpdates', 'oeffne', 'schliesse', 'koppele', 'fuehreAus',
  'anstossen', 'neueKennung', 'starteMasterSuche', 'open', 'openSettings', 'openSystem', 'openScenarios', 'openShowEditor',
  'openShowEditorWith', 'openOnboarding', 'openPatchNotes', 'openSideEvents', 'openFeedback', 'openCookbook', 'setView'];
/** Befunde zu G3: Aufruf eines Namens, Lesen als Store-Feld, window.jmps außer getControlStatus, setState auf fremde Stores. */
function g3Befunde(quelle: string): string[] {
  const q = ohneKommentare(quelle);
  const befunde: string[] = [];
  for (const n of G3_NAMEN) {
    if (new RegExp(`(?<![\\w$])${n}\\s*\\(`).test(q)) befunde.push(`${n}(…)`);
    if (new RegExp(`(?:\\bs|getState\\(\\))\\.${n}\\b`).test(q)) befunde.push(`.${n}`);
  }
  for (const m of q.matchAll(/window\.jmps\.(\w+)/g)) if (m[1] !== 'getControlStatus') befunde.push(`window.jmps.${m[1]}`);
  if (/use(?:Tools|Verbund)\.setState\(/.test(q)) befunde.push('setState auf Launcher oder Verbund');
  return [...new Set(befunde)];
}
/** true, wenn Stelle i in einem try-Block liegt (letztes „try {“ davor ohne „} catch“ dazwischen). */
function imTry(q: string, i: number): boolean {
  const vor = q.slice(0, i);
  const t = vor.lastIndexOf('try {');
  return t >= 0 && !vor.slice(t).includes('} catch');
}
/** Speicher-Attrappe (G8): zählt Lese- und Schreibzugriffe; `liestNicht`/`schreibtNicht` lassen den Zugriff werfen. */
function speicherAttrappe(start: Record<string, string> = {}, o: { liestNicht?: boolean; schreibtNicht?: boolean } = {}) {
  const a = {
    daten: new Map(Object.entries(start)),
    gelesen: 0,
    geschrieben: 0,
    liestNicht: o.liestNicht === true,
    schreibtNicht: o.schreibtNicht === true,
    speicher: {
      getItem(k: string): string | null {
        a.gelesen++;
        if (a.liestNicht) throw new Error('Speicher gesperrt');
        return a.daten.get(k) ?? null;
      },
      setItem(k: string, v: string): void {
        if (a.schreibtNicht) throw new Error('Speicher voll');
        a.geschrieben++;
        a.daten.set(k, v);
      },
    },
  };
  return a;
}
/** Eingang des Adapters ohne geladene Daten (nur Voreinstellungen, G7). */
const EINGANG_LEER: AnleitungsEingang = {
  settings: null, states: {}, view: 'catalog', settingsOpen: false, systemOpen: false, scenariosOpen: false, showEditorOpen: false,
  verbundOffen: false, verbund: null, steuerebene: null, recentShows: 0, laufendeTools: 0, showLaunch: false, iveoActive: false,
};
/** Master, dessen verteilte Show Tools anderer Rechner beziehen (EP17), und ein gekoppelter, verbundener Slave (EP5). */
const MASTER_FOLGT = { rolle: 'master', dateiFehler: null, slave: null, master: { showImVerbund: { showName: 'Konferenz', bezieher: 2 } } } as unknown as VerbundStand;
const SLAVE_VERBUNDEN = { rolle: 'slave', dateiFehler: null, master: null, slave: { gekoppelt: true, client: { art: 'verbunden' } } } as unknown as VerbundStand;
/**
 * Treiber des Stores mit dem echten Ablaufkern (@jm/ui/anleitung), der echten Anleitung und Attrappen: Speicher, Eingang, Uhr
 * (Millisekunden), Wecker (gesammelt, im Test von Hand ausgelöst) und der Stand wie im Store.
 */
function treiberMit(sp: ReturnType<typeof speicherAttrappe> | null, eingang: Partial<AnleitungsEingang> = {}) {
  const lage = {
    eingang: { ...EINGANG_LEER, ...eingang } as AnleitungsEingang,
    uhr: 0,
    wecker: [] as Array<{ ms: number; f: () => void }>,
    stand: {
      fortschritt: leererFortschritt(EINRICHTUNG.id), speicher: 'leer', hinweis: false, jetzt: {}, produktion: false,
      produktionUnklar: false, stimmeTrotzdem: false,
    } as TreiberStand,
  };
  const t = erzeugeAnleitungsTreiber({
    kern: { leseFortschritt, beimStart, anleitungSchritt, schreibeFortschritt },
    anleitung: EINRICHTUNG,
    schluessel: ANLEITUNG_SCHLUESSEL,
    speicher: () => sp?.speicher ?? null,
    eingang: () => lage.eingang,
    uhr: () => lage.uhr,
    wecker: (ms, f) => {
      lage.wecker.push({ ms, f });
    },
    lies: () => lage.stand,
    setze: (teil) => {
      lage.stand = { ...lage.stand, ...teil };
    },
  });
  return { t, lage };
}

// --- Geführte Anleitung P12 (Spec 3–8; EP4, EP5, EP7, EP8, EP17, EP19, EP23, EP24; G3, G7, G8, G9, G15): Treiber und Store -
{
  const K = ANLEITUNG_SCHLUESSEL;
  const leer = leererFortschritt(EINRICHTUNG.id);
  const json = (x: unknown): string => JSON.stringify(x);
  const ort = (p: { ort: string; schritt?: string | null } | null): string => (p === null ? 'kein Ort' : p.ort === 'kapitel' ? String(p.schritt) : p.ort);

  // Start je Speicher und Rechner (Spec 4, G8, EP8, EP23): Rückgabe, Diagnose, Hinweis am Knopf, Status, Schreibzugriffe.
  const START: Array<[string, () => ReturnType<typeof speicherAttrappe> | null, boolean, string]> = [
    ['leer, neuer Rechner', () => speicherAttrappe(), false, 'anleitung leer false laeuft 1'],
    ['leer, bestehender Rechner', () => speicherAttrappe(), true, 'hinweis leer true nieGestartet 1'],
    ['Lesen wirft', () => speicherAttrappe({}, { liestNicht: true }), false, 'null nichtLesbar true nieGestartet 0'],
    ['Lesen wirft, bestehender Rechner', () => speicherAttrappe({}, { liestNicht: true }), true, 'null nichtLesbar true nieGestartet 0'],
    ['kein Speicher', () => null, false, 'null nichtLesbar true nieGestartet -'],
    ['kaputtes JSON', () => speicherAttrappe({ [K]: '{kaputt' }), false, 'null kaputt false nieGestartet 1'],
    ['neuere Fassung', () => speicherAttrappe({ [K]: '{"format":2}' }), false, 'null neuer false nieGestartet 0'],
    ['pausiert gemerkt', () => speicherAttrappe({ [K]: json({ ...leer, status: 'pausiert', position: { ort: 'einleitung' } }) }), false, 'null ok false pausiert 0'],
    ['lief beim Beenden', () => speicherAttrappe({ [K]: json({ ...leer, status: 'laeuft', position: { ort: 'einleitung' } }) }), false, 'null ok false pausiert 1'],
    ['Schreiben wirft', () => speicherAttrappe({}, { schreibtNicht: true }), false, 'anleitung nichtSchreibbar false laeuft 0'],
  ];
  const startAbw: string[] = [];
  for (const [name, neu, bestehend, soll] of START) {
    const sp = neu();
    const { t, lage } = treiberMit(sp);
    const r = t.starte({ bestehenderRechner: bestehend });
    const ist = `${r} ${lage.stand.speicher} ${lage.stand.hinweis} ${lage.stand.fortschritt.status} ${sp === null ? '-' : sp.geschrieben}`;
    if (ist !== soll) startAbw.push(`${name}: ${ist}`);
  }
  ck(`P12 4, G8, EP8, EP23: starte je Speicher und Rechner — Rückgabe, Diagnose, Hinweis am Knopf, Status, Schreiben (${START.length} Fälle)${startAbw.length ? ` — ${startAbw.join('; ')}` : ''}`,
    startAbw.length === 0);

  // Rundreise (Spec 3, G8): der Fortschritt nach Start und Ereignissen übersteht einen Neustart (neuer Treiber, derselbe Speicher).
  const rs = speicherAttrappe();
  const vorNeustart = treiberMit(rs);
  vorNeustart.t.starte({ bestehenderRechner: false });
  vorNeustart.t.ereignis({ art: 'weiter' });
  vorNeustart.t.ereignis({ art: 'ueberspringen' });
  vorNeustart.t.ereignis({ art: 'brauchtNicht', kapitel: 'k5' });
  vorNeustart.t.ereignis({ art: 'spaeter' });
  const nachNeustart = treiberMit(rs);
  nachNeustart.t.starte({ bestehenderRechner: false });
  const f1 = vorNeustart.lage.stand.fortschritt;
  const f2 = nachNeustart.lage.stand.fortschritt;
  ck(`P12 3, G8: Rundreise — Fortschritt nach Start, „Überspringen“, „Brauche ich nicht“ und „Später weiter“ übersteht den Neustart${json(f1) === json(f2) ? ''
    : ` — danach ${f2.status} an ${ort(f2.position)}, übersprungen [${f2.uebersprungen.join(',')}], nicht gebraucht [${f2.nichtGebraucht.join(',')}]`}`,
    f1.status === 'pausiert' && f1.uebersprungen.includes('k1') && f1.nichtGebraucht.includes('k5') && json(f1) === json(f2));

  // Merken (G7, G8): Schreibfehler als Diagnose, ein späterer Erfolg wieder „ok“; neuere Fassung und unlesbarer Speicher
  // werden nie beschrieben, der Ablauf läuft dann nur in dieser Sitzung.
  const merkAbw: string[] = [];
  const voll = speicherAttrappe({}, { schreibtNicht: true });
  const tv = treiberMit(voll);
  tv.t.starte({ bestehenderRechner: false });
  const nachFehler = tv.lage.stand.speicher;
  voll.schreibtNicht = false;
  tv.t.ereignis({ art: 'weiter' });
  if (nachFehler !== 'nichtSchreibbar' || tv.lage.stand.speicher !== 'ok' || voll.geschrieben !== 1) {
    merkAbw.push(`Schreibfehler: ${nachFehler} → ${tv.lage.stand.speicher}, ${voll.geschrieben} geschrieben`);
  }
  for (const [name, sp] of [['neuere Fassung', speicherAttrappe({ [K]: '{"format":2}' })], ['Lesen wirft', speicherAttrappe({}, { liestNicht: true })]] as const) {
    const vorher = json([...sp.daten]);
    const { t, lage } = treiberMit(sp);
    t.starte({ bestehenderRechner: false });
    t.ereignis({ art: 'starten' });
    if (sp.geschrieben !== 0 || json([...sp.daten]) !== vorher || lage.stand.fortschritt.status !== 'laeuft') {
      merkAbw.push(`${name}: ${sp.geschrieben} geschrieben, ${lage.stand.fortschritt.status}`);
    }
  }
  ck(`P12 G7, G8: Merken — Schreibfehler als Diagnose und danach wieder „ok“; neuere Fassung und unlesbarer Speicher bleiben unberührt, der Ablauf läuft trotzdem${merkAbw.length ? ` — ${merkAbw.join('; ')}` : ''}`,
    merkAbw.length === 0);

  // Abgleich (Spec 5, EP5): ein geänderter Zustand führt den Kern von selbst weiter (Regel 11), ein neues Tool-Ereignis wird gemerkt.
  const sa = speicherAttrappe();
  const ta = treiberMit(sa);
  ta.t.starte({ bestehenderRechner: false });
  ta.t.ereignis({ art: 'weiter' });
  const ort1 = ort(ta.lage.stand.fortschritt.position);
  ta.lage.eingang = { ...ta.lage.eingang, settingsOpen: true };
  ta.t.pruefe();
  const ort2 = ort(ta.lage.stand.fortschritt.position);
  ta.lage.eingang = { ...ta.lage.eingang, verbund: SLAVE_VERBUNDEN };
  ta.t.pruefe();
  const gemerkt = (JSON.parse(sa.daten.get(K) ?? '{}') as { ereignisse?: Record<string, string> }).ereignisse ?? {};
  ck(`P12 5, EP5: Abgleich — geänderter Zustand führt von selbst weiter (${ort1} → ${ort2}), ein neues Tool-Ereignis wird gemerkt`,
    ort1 === 'k1.einstellungen' && ort2 === 'k1.zugang' && ta.lage.stand.jetzt.einstellungenOffen === true
    && typeof ta.lage.stand.fortschritt.ereignisse.slaveWarVerbunden === 'string' && typeof gemerkt.slaveWarVerbunden === 'string');

  // Vor starte bewirkt nichts etwas (D6): ein Klick vor dem Ende von load() schriebe sonst über den ungelesenen Fortschritt.
  const fs0 = speicherAttrappe();
  const tf = treiberMit(fs0);
  tf.t.ereignis({ art: 'starten' });
  tf.t.pruefe();
  ck(`P12 D6: vor starte (also vor load) bewirken Ereignis und Abgleich nichts (${fs0.gelesen} gelesen, ${fs0.geschrieben} geschrieben)`,
    json(tf.lage.stand.fortschritt) === json(leer) && fs0.gelesen === 0 && fs0.geschrieben === 0);

  // Einmal je Fenster (D15): React StrictMode ruft load() im Dev zweimal; der zweite starte darf nicht pausieren.
  const zs = speicherAttrappe();
  const tz = treiberMit(zs);
  const r1 = tz.t.starte({ bestehenderRechner: false });
  const r2 = tz.t.starte({ bestehenderRechner: false });
  ck(`P12 4, D15: starte wirkt je Fenster einmal — der zweite Aufruf gibt das erste Ergebnis zurück, liest und schreibt nichts (${zs.gelesen} gelesen, ${zs.geschrieben} geschrieben, ${tz.lage.stand.fortschritt.status})`,
    r1 === 'anleitung' && r2 === 'anleitung' && zs.gelesen === 1 && zs.geschrieben === 1 && tz.lage.stand.fortschritt.status === 'laeuft'
    && tz.lage.wecker.length === 1);

  // Produktion und „unklar“ (Spec 7; EP17, EP24): wie der Adapter, dazu kurz nach dem Start „unklar“, solange auf diesem
  // Rechner Tools installiert sind und keins als laufend bekannt ist (die Presence ist nach einem Neustart bis zu 10 s leer).
  let nP = 0;
  const abwP: string[] = [];
  for (const installiert of [false, true]) for (const uhr of [0, PRESENCE_FRIST_MS - 1, PRESENCE_FRIST_MS]) for (const laufend of [0, 1])
    for (const launch of [false, true]) for (const iveo of [false, true]) for (const folgt of [false, true]) {
      nP++;
      const { t, lage } = treiberMit(speicherAttrappe(), { states: installiert ? { 'jm-timer': { status: 'installed' } } : {} });
      t.starte({ bestehenderRechner: false });
      lage.uhr = uhr;
      lage.eingang = { ...lage.eingang, laufendeTools: laufend, showLaunch: launch, iveoActive: iveo, verbund: folgt ? MASTER_FOLGT : null };
      t.pruefe();
      const produktion = laufend > 0 || launch || iveo || folgt;
      const unklar = !produktion && installiert && uhr < 12_000;
      if (lage.stand.produktion !== produktion || lage.stand.produktionUnklar !== unklar) {
        abwP.push(`${installiert ? 'installiert' : 'nichts installiert'}/${uhr} ms/${laufend}/${launch}/${iveo}/${folgt}: ${lage.stand.produktion} ${lage.stand.produktionUnklar}`);
      }
    }
  ck(`P12 7, EP17, EP24: Produktion und „unklar“ im Store — installiert × Zeit seit dem Start × Tool läuft × Show-Start × iveo × Master folgt (${nP} Fälle)${abwP.length ? ` — ${abwP.slice(0, 3).join('; ')}` : ''}`,
    nP === 96 && abwP.length === 0);
  const tw = treiberMit(speicherAttrappe(), { states: { 'jm-timer': { status: 'installed' } } });
  tw.t.starte({ bestehenderRechner: false });
  const unklarAmStart = tw.lage.stand.produktionUnklar;
  tw.lage.uhr = 12_000;
  for (const w of tw.lage.wecker) w.f();
  ck(`P12 EP24: „unklar“ endet nach 12 s von selbst, auch ohne jede andere Änderung (Wecker: ${tw.lage.wecker.map((w) => `${w.ms} ms`).join(', ') || 'keiner'})`,
    PRESENCE_FRIST_MS === 12_000 && unklarAmStart && tw.lage.wecker.length === 1 && tw.lage.wecker[0].ms === 12_000 && !tw.lage.stand.produktionUnklar);

  // „Stimme trotzdem an“ (Spec 7, G15): nur in einer Produktion, und nur bis zu ihrem Ende; die nächste beginnt wieder still.
  const tt = treiberMit(speicherAttrappe(), { laufendeTools: 1 });
  tt.t.starte({ bestehenderRechner: false });
  tt.t.stimmeTrotzdemAn();
  const waehrend = tt.lage.stand.stimmeTrotzdem;
  tt.lage.eingang = { ...tt.lage.eingang, laufendeTools: 0 };
  tt.t.pruefe();
  const nachEnde = tt.lage.stand.stimmeTrotzdem;
  tt.lage.eingang = { ...tt.lage.eingang, laufendeTools: 1 };
  tt.t.pruefe();
  const naechste = tt.lage.stand.stimmeTrotzdem;
  const ohne = treiberMit(speicherAttrappe());
  ohne.t.starte({ bestehenderRechner: false });
  ohne.t.stimmeTrotzdemAn();
  ck(`P12 6, 7, G15: „Stimme trotzdem an“ gilt bis zum Ende dieser Produktion, die nächste beginnt still; ohne Produktion wirkt es nicht (${waehrend}, ${nachEnde}, ${naechste}, ${ohne.lage.stand.stimmeTrotzdem})`,
    waehrend && !nachEnde && !naechste && !ohne.lage.stand.stimmeTrotzdem);

  // Eingang aus den Zuständen des Launchers (G9; Spec 5, 7; EP17): anleitungsEingang ist der einzige Konstruktor des Eingangs,
  // der Store ruft nur sie auf. Ein Fehler dort ließe die Stimme während der Show sprechen oder Kapitel 3, 5 und 6 nie
  // abhaken; die Erwartung rechnet der Test selbst, ohne den Adapter (Nachprüfung 1, Nachbesserung N52).
  const LAGE_LEER: LauncherLage = {
    settings: null, states: {}, view: 'catalog', settingsOpen: false, systemOpen: false, scenariosOpen: false, showEditorOpen: false,
    recentShows: [], presence: [], showLaunch: null, iveoActive: null,
  };
  const PRESENCE: Array<[string, Array<{ running: boolean }>, number]> = [
    ['leer', [], 0], ['beendet', [{ running: false }], 0], ['einer läuft', [{ running: false }, { running: true }], 1],
    ['zwei laufen', [{ running: true }, { running: false }, { running: true }], 2],
  ];
  const STAENDE: Array<[string, VerbundStand | null, boolean]> = [
    ['kein Stand', null, false], ['Master, dem Tools folgen', MASTER_FOLGT, true], ['Slave verbunden', SLAVE_VERBUNDEN, false],
  ];
  const showLaunchAus = (an: boolean): LauncherLage['showLaunch'] => (an ? { name: 'Konferenz' } : null);
  const iveoAus = (an: boolean): LauncherLage['iveoActive'] => (an ? { event: 'e1', canSwitch: false } : null);
  let nE = 0;
  const abwE: string[] = [];
  for (const [pName, presence, laufend] of PRESENCE) for (const launch of [false, true]) for (const iveo of [false, true])
    for (const [vName, stand, folgt] of STAENDE) {
      nE++;
      const e = anleitungsEingang({ ...LAGE_LEER, presence, showLaunch: showLaunchAus(launch), iveoActive: iveoAus(iveo) }, { offen: false, stand }, null);
      if (produktionLaeuft(e) !== (laufend > 0 || launch || iveo || folgt)) abwE.push(`${pName}/${launch}/${iveo}/${vName}: ${produktionLaeuft(e)}`);
    }
  ck(`P12 7, EP17, G15: Produktion aus dem Zustand des Launchers — Presence (leer, beendet, läuft) × Show-Start × iveo × Verbund (${nE} Fälle)${abwE.length ? ` — ${abwE.slice(0, 3).join('; ')}` : ''}`,
    nE === 48 && abwE.length === 0);
  const SETTINGS: Array<[string, LauncherLage['settings'], AnleitungsEingang['settings']]> = [
    ['keine', null, null],
    ['Quelle none', { source: 'none', hasToken: false, fromEnv: false } as LauncherLage['settings'], { source: 'none' }],
    ['GitHub', { source: 'github', hasToken: true, fromEnv: true, manifestUrl: 'https://x' } as LauncherLage['settings'], { source: 'github' }],
  ];
  const FENSTER: Array<[string, Partial<LauncherLage>, boolean]> = [
    ['alles zu', {}, false], ['Einstellungen', { settingsOpen: true }, false], ['System', { systemOpen: true }, false],
    ['Szenarien', { scenariosOpen: true }, false], ['Editor', { showEditorOpen: true }, false], ['Verbund', {}, true],
    ['Reiter JM Show', { view: 'jmshow' }, false],
  ];
  let nF = 0;
  const abwF: string[] = [];
  for (const [pName, presence, laufend] of PRESENCE) for (const launch of [false, true]) for (const iveo of [false, true])
    for (const [vName, stand] of STAENDE) for (const recent of [0, 1, 2]) for (const [sName, settings, sSoll] of SETTINGS)
      for (const steuerebene of [null, 'open', 'secure'] as const) for (const states of [{}, { 'jm-timer': { status: 'installed' } }])
        for (const [fName, fenster, verbundOffen] of FENSTER) {
          nF++;
          const lage: LauncherLage = {
            ...LAGE_LEER, ...fenster, settings, states, presence, recentShows: Array.from({ length: recent }, (_, i) => ({ name: `Show ${i}` })),
            showLaunch: showLaunchAus(launch), iveoActive: iveoAus(iveo),
          };
          const soll: Record<string, unknown> = {
            settings: sSoll, states, view: fenster.view ?? 'catalog', settingsOpen: fenster.settingsOpen === true,
            systemOpen: fenster.systemOpen === true, scenariosOpen: fenster.scenariosOpen === true, showEditorOpen: fenster.showEditorOpen === true,
            verbundOffen, verbund: stand, steuerebene, recentShows: recent, laufendeTools: laufend, showLaunch: launch, iveoActive: iveo,
          };
          const ist = anleitungsEingang(lage, { offen: verbundOffen, stand }, steuerebene) as unknown as Record<string, unknown>;
          const falsch = [...new Set([...Object.keys(ist), ...Object.keys(soll)])].filter((k) => json(ist[k]) !== json(soll[k]));
          if (falsch.length) abwF.push(`${pName}/${launch}/${iveo}/${vName}/${recent}/${sName}/${steuerebene}/${fName}: ${falsch.join(',')}`);
        }
  ck(`P12 5, G7, G9: Eingang aus dem Zustand des Launchers — jedes Feld wie im Launcher, eine Voreinstellung bleibt eine (${nF} Fälle)${abwF.length ? ` — ${abwF.length} abweichend, ${abwF.slice(0, 2).join('; ')}` : ''}`,
    nF === 18144 && abwF.length === 0);

  // Verdrahtung des Stores (Quelltext-Wächter; der Store lädt zustand und window.jmps und läuft hier nicht).
  const store = quelleLfOderLeer('../src/renderer/src/store/anleitung.ts');
  const code = ohneKommentare(store);
  const tools = quelleLf('../src/renderer/src/store/tools.ts');
  const starte = funktionsKoerper(store, 'starte: (u) => {');
  const abonniere = funktionsKoerper(store, 'function abonniere(): void {');
  const laden = funktionsKoerper(store, 'ladeSteuerebene: async () => {');
  const b = g3Befunde(store);
  ck(`P12 G3: der Store der Anleitung bedient nichts und öffnet keinen Dialog, er liest nur (IPC getControlStatus)${b.length ? ` — ${b.join(', ')}` : ''}`,
    store.length > 0 && b.length === 0 && store.includes('const status = await window.jmps.getControlStatus();'));
  ck('P12 3–8: der Store führt nur aus — der Treiber bekommt Ablaufkern, Speicher, Uhr, Wecker und den Store-Zustand; Start und Ereignisse gehen an ihn',
    ['  const treiber = erzeugeAnleitungsTreiber({', '    kern: { leseFortschritt, beimStart, anleitungSchritt, schreibeFortschritt },',
      '    anleitung: EINRICHTUNG,', '    schluessel: ANLEITUNG_SCHLUESSEL,', '    speicher: launcherSpeicher,', '    eingang: () => get().eingang(),',
      '    uhr: () => Date.now(),', '    wecker: (ms, f) => void setTimeout(f, ms),', '    lies: () => get(),', '    setze: (teil) => set(teil),',
      '    ereignis: (e) => treiber.ereignis(e),', "    toolEreignis: (name) => treiber.ereignis({ art: 'toolEreignis', name }),",
      '    zustand: () => treiber.zustand(),', '    stimmeTrotzdemAn: () => treiber.stimmeTrotzdemAn(),'].every((z) => store.includes(z))
    && starte.includes('const start = treiber.starte(u);') && starte.includes('return start;'));
  ck('P12 G9, EP17: der Store baut den Eingang nur über anleitungsEingang aus Launcher, Verbund und der gelesenen Steuerebene',
    store.includes('    eingang: () => anleitungsEingang(useTools.getState(), useVerbund.getState(), get().steuerebene),')
    && !/laufendeTools|iveoActive|showLaunch|presence/.test(code));
  const zugriffe = [...code.matchAll(/localStorage|\.getItem\(|\.setItem\(/g)].map((m) => m.index ?? -1);
  ck(`P12 G8: jeder Zugriff auf localStorage steht in try/catch (${zugriffe.length} Stellen)`,
    zugriffe.length >= 3 && zugriffe.every((i) => imTry(code, i)));
  ck('P12 EP4, 6: Schlüssel aus der Anleitungs-Datei; Stimme je Rechner (aus/an), nicht lesbar → an',
    store.includes("import { ANLEITUNG_SCHLUESSEL, EINRICHTUNG, STIMME_SCHLUESSEL } from '@/anleitung/einrichtung';")
    && !code.includes("'jmps:") && store.includes("return launcherSpeicher()?.getItem(STIMME_SCHLUESSEL) !== 'aus';"));
  ck('P12 5, EP5: Abos auf Launcher und Verbund lösen den Abgleich des Treibers aus',
    abonniere.includes('useTools.subscribe((s, vorher) => {') && abonniere.includes('      treiber.pruefe();')
    && abonniere.includes('useVerbund.subscribe(() => treiber.pruefe());'));
  ck('P12 EP19: Steuerebene nur gelesen — beim Start, bei Fensterfokus, nach dem Schließen von System-Zustand und Einstellungen',
    starte.includes('void get().ladeSteuerebene();') && abonniere.includes("window.addEventListener('focus', () => void get().ladeSteuerebene());")
    && abonniere.includes('if ((vorher.systemOpen && !s.systemOpen) || (vorher.settingsOpen && !s.settingsOpen)) void get().ladeSteuerebene();')
    && laden.includes('treiber.pruefe();') && (code.match(/window\.jmps\./g) ?? []).length === 1);
  ck('P12 Zyklus tools ↔ anleitung: Launcher und Verbund nur in Funktionen, Abos erst in starte (aus load)',
    (code.match(/useTools\./g) ?? []).length === 2 && abonniere.includes('useTools.subscribe(')
    && store.includes('eingang: () => anleitungsEingang(useTools.getState(), useVerbund.getState(),') && starte.includes('abonniere();'));
  const save = funktionsKoerper(tools, 'saveShow: async (show, targetPath, neuGebunden) => {');
  ck('P12 5, EP5: saveShow meldet „Show gespeichert“ nur nach res.ok (kein dauerhafter Zustand, Ist-L 3)',
    save.includes("      if (res.ok) useAnleitung.getState().toolEreignis('showGespeichert');\n      return res.ok;")
    && save.indexOf('const res = await window.jmps.saveShow(') < save.indexOf("toolEreignis('showGespeichert')")
    && (tools.match(/toolEreignis\('showGespeichert'\)/g) ?? []).length === 1);
  const aufrufer: string[] = [];
  for (const datei of readdirSync(new URL('../src/renderer/src/', import.meta.url), { recursive: true }) as string[]) {
    const pfad = datei.replace(/\\/g, '/');
    if (!/\.tsx?$/.test(pfad)) continue;
    const n = (quelleLf(`../src/renderer/src/${pfad}`).match(/\bsaveShow\(/g) ?? []).length;
    if (n) aufrufer.push(`${pfad}:${n}`);
  }
  ck(`P12 G9: Aufrufer von saveShow unverändert (${aufrufer.sort().join(', ')})`,
    aufrufer.join(',') === 'components/ShowEditorModal.tsx:1,store/tools.ts:1'
    && quelleLf('../src/renderer/src/components/ShowEditorModal.tsx').includes('const ok = await saveShow(show, editPath ?? undefined, f.iveoNeuGebunden !== null);'));
}

// --- Geführte Anleitung P13 (Spec 4, OF2; EP7–EP9): Startregeln und „Was ist neu?“ danach ------------------------------
{
  const faelle: StartEingang[] = [];
  for (const start of ['anleitung', 'hinweis', null] as const)
    for (const version of ['0.17.0', null] as const)
      for (const gesehen of ['0.17.0', '0.16.0', null] as const)
        for (const hatNotes of [true, false]) faelle.push({ start, version, gesehen, hatNotes });
  // Erwartung (EP9): fällig = Version da, anders als gesehen, Notes da. Der erste automatische Start (noch keine Fassung
  // gesehen) merkt die Fassung und zeigt nichts; sonst wartet „Was ist neu?“ hinter einer laufenden Anleitung oder kommt sofort.
  const soll = (e: StartEingang) => {
    const faellig = e.version !== null && e.gesehen !== e.version && e.hatNotes;
    if (e.start === 'anleitung' && e.gesehen === null && e.version !== null) {
      return { patchNotesJetzt: false, patchNotesNachAnleitung: false, gesehenSchreiben: e.version };
    }
    if (e.start === 'anleitung') return { patchNotesJetzt: false, patchNotesNachAnleitung: faellig, gesehenSchreiben: null };
    return { patchNotesJetzt: faellig, patchNotesNachAnleitung: false, gesehenSchreiben: null };
  };
  const abw = faelle.filter((e) => JSON.stringify(startEntscheidung(e)) !== JSON.stringify(soll(e)));
  ck(`P13 4, EP9: startEntscheidung = Erwartung (${faelle.length} Fälle)${abw.length ? ` — ${abw.slice(0, 3).map((e) => JSON.stringify(e)).join('; ')}` : ''}`,
    abw.length === 0);
  ck('P13 4: „Was ist neu?“ nie zugleich mit der von selbst startenden Anleitung und nie doppelt (sofort und danach)',
    faelle.every((e) => { const r = startEntscheidung(e); return !(r.patchNotesJetzt && (e.start === 'anleitung' || r.patchNotesNachAnleitung)); }));
  ck('P13 EP9: „gesehen“ wird nur beim ersten automatischen Start geschrieben (nie beim Hinweis, nie ohne Version)',
    faelle.every((e) => (startEntscheidung(e).gesehenSchreiben !== null) === (e.start === 'anleitung' && e.gesehen === null && e.version !== null)));
  const erster = startEntscheidung({ start: 'anleitung', version: '0.17.0', gesehen: null, hatNotes: true });
  const zweiter = startEntscheidung({ start: null, version: '0.17.0', gesehen: erster.gesehenSchreiben, hatNotes: true });
  ck('P13 EP9 (Ist-L 11 Nr. 1): erster Start mit Anleitung ohne „Was ist neu?“ — und der zweite Start ohne Update auch nicht',
    erster.gesehenSchreiben === '0.17.0' && !erster.patchNotesJetzt && !erster.patchNotesNachAnleitung && !zweiter.patchNotesJetzt);
  const nachNeustart = startEntscheidung({ start: 'anleitung', version: '0.17.0', gesehen: '0.16.0', hatNotes: true });
  const hinweisUpdate = startEntscheidung({ start: 'hinweis', version: '0.17.0', gesehen: '0.16.0', hatNotes: true });
  ck('P13 EP7, OF2: Fortsetzen nach dem Neustart mit neuer Fassung → „Was ist neu?“ danach; bestehender Rechner mit Hinweis → sofort',
    nachNeustart.patchNotesNachAnleitung && !nachNeustart.patchNotesJetzt && nachNeustart.gesehenSchreiben === null
    && hinweisUpdate.patchNotesJetzt && hinweisUpdate.gesehenSchreiben === null);
}
{
  const tools = quelleLf('../src/renderer/src/store/tools.ts');
  const anleitung = quelleLfOderLeer('../src/renderer/src/store/anleitung.ts');
  const load = funktionsKoerper(tools, 'load: async () => {');
  const iStart = load.indexOf('const start = useAnleitung.getState().starte({ bestehenderRechner: readOnboarded() });');
  const iEnt = load.indexOf('const notes = startEntscheidung({');
  const iNotes = load.indexOf("if (notes.patchNotesJetzt && version) set({ patchNotes: { app: 'launcher', highlight: version } });");
  ck('P13 4, EP7–EP9: load() fragt zuerst die Anleitung, dann startEntscheidung, dann „Was ist neu?“',
    iStart >= 0 && iStart < iEnt && iEnt < iNotes);
  ck('P13 EP8: die Checkliste öffnet sich nicht mehr von selbst; jmps:onboardedV1 wird nur noch gelesen',
    load.length > 0 && !load.includes('onboardingOpen: true') && !tools.includes('setItem(ONBOARDED_KEY')
    && tools.includes("    return localStorage.getItem(ONBOARDED_KEY) === '1';"));
  const nach = funktionsKoerper(tools, 'function zeigePatchNotesNachAnleitung(version: string): void {');
  ck('P13 EP9: „gesehen“ beim ersten automatischen Start (in try/catch); zurückgestellte Notes, sobald die Anleitung nicht mehr läuft',
    load.includes('localStorage.setItem(SEEN_VERSION_KEY, notes.gesehenSchreiben);') && imTry(load, load.indexOf('localStorage.setItem(SEEN_VERSION_KEY'))
    && load.includes('if (notes.patchNotesNachAnleitung && version) zeigePatchNotesNachAnleitung(version);')
    && nach.includes("if (a.fortschritt.status === 'laeuft' || !a.patchNotesNachAnleitung) return;")
    && nach.includes("set({ patchNotes: { app: 'launcher', highlight: version } });")
    && anleitung.includes('    patchNotesNachAnleitung: false,'));
  // D15: React StrictMode ruft load() im Dev zweimal (main.tsx); das zweite Mal darf „Was ist neu?“ nicht noch einmal abonnieren.
  const nurEinmal = 'if (useAnleitung.getState().patchNotesNachAnleitung) return;';
  ck('P13 4, D15: „Was ist neu?“ nach der Anleitung wird je Fenster nur einmal abonniert, auch wenn load() zweimal läuft',
    nach.includes(nurEinmal) && nach.indexOf(nurEinmal) < nach.indexOf('useAnleitung.setState({ patchNotesNachAnleitung: true });'));
  // D20: die Update-Prüfungen stehen vor dem neuen Code der Anleitung — ein Fehler dort hält sie nicht auf.
  const nachSet = load.slice(Math.max(0, load.indexOf('set({ tools, states: byId(states), settings, version, loading: false });')));
  const iStartNachSet = nachSet.indexOf('const start = useAnleitung.getState().starte(');
  const vorDerAnleitung = ['void useTools.getState().checkUpdates();', 'void useTools.getState().loadLauncherUpdate();', 'void useTools.getState().loadPresence();']
    .filter((z) => { const i = nachSet.indexOf(z); return i > 0 && i < iStartNachSet; });
  ck(`P13 4, D20: Update-Hinweis, Badges und Presence werden vor der Anleitung angestoßen (${vorDerAnleitung.length} von 3)`,
    iStartNachSet > 0 && vorDerAnleitung.length === 3);
}

// --- Geführte Anleitung P14 (Spec 3, 6, 7; EP11, EP15, EP17–EP19, EP23, EP24; G3, G7, G15): Overlay mit Stimme und Produktionsmodus
{
  const json = (x: unknown): string => JSON.stringify(x);

  // Produktion bis zur Ansage (Spec 7, G15; EP17, EP24): Treiber → Umgebung → echte Ansicht → Blase im Launcher. Erwartung aus
  // den Achsen: still = Produktion oder „unklar“; trotzdem wirkt nur in einer echten Produktion; ein Eingriff spricht nie und
  // zeigt nur; bei „unklar“ behauptet die Blase keine Produktion (keine Warnung U18, statt U21 der Hinweis L15).
  const K6_OEFFNEN = json({ ...leererFortschritt(EINRICHTUNG.id), status: 'pausiert',
    position: { ort: 'kapitel', kapitel: 'k6', schritt: 'k6.oeffnen', nurZeigen: false, warErfuellt: false } });
  let nX = 0;
  const abwX: string[] = [];
  for (const eingriff of [false, true]) for (const laufend of [0, 1]) for (const launch of [false, true]) for (const iveo of [false, true])
    for (const folgt of [false, true]) for (const unklarAchse of [false, true]) for (const an of [false, true]) for (const trotzdem of [false, true]) {
      nX++;
      const { t, lage } = treiberMit(speicherAttrappe(eingriff ? { [ANLEITUNG_SCHLUESSEL]: K6_OEFFNEN } : {}), {
        states: unklarAchse ? { 'jm-timer': { status: 'installed' } } : {},
        laufendeTools: laufend, showLaunch: launch, iveoActive: iveo, verbund: folgt ? MASTER_FOLGT : null,
      });
      t.starte({ bestehenderRechner: false });
      if (eingriff) t.ereignis({ art: 'starten' });
      if (trotzdem) t.stimmeTrotzdemAn();
      const s = lage.stand;
      const ansicht = anleitungAnsicht(EINRICHTUNG, s.fortschritt, s.jetzt, anleitungsUmgebung({ ...s, stimmeAn: an }, true));
      const b = launcherBlase(ansicht, s, { stimmeWartet: 'L15', nichtGemerkt: 'U26' }).blase;
      const prod = laufend > 0 || launch || iveo || folgt;
      const unklar = !prod && unklarAchse;
      const still = prod || unklar;
      const wirkt = trotzdem && prod;
      const soll = {
        id: eingriff ? 'k6.oeffnen' : 'einleitung',
        spielen: an && (!still || wirkt) && !(still && eingriff),
        nurZeigen: still && eingriff,
        warnung: prod && eingriff,
        hinweis: !an ? 'aus' : unklar ? null : prod && eingriff ? 'eingriff' : prod && !wirkt ? 'produktion' : null,
        text: unklar && an ? 'L15' : null,
      };
      const ist = { id: b?.ansage.id, spielen: b?.ansage.spielen, nurZeigen: b?.nurZeigen, warnung: b?.produktionsWarnung, hinweis: b?.ansage.hinweis, text: b?.wiederfinden };
      if (json(ist) !== json(soll)) {
        abwX.push(`${eingriff ? 'Eingriff' : 'Einleitung'}/${laufend}/${launch}/${iveo}/${folgt}/${unklarAchse ? 'unklar' : '-'}/${an ? 'an' : 'aus'}/${trotzdem ? 'trotzdem' : '-'}: ${json(ist)}`);
      }
    }
  ck(`P14 7, G15, EP17, EP24: Produktion bis zur Ansage — Schritt × Tool läuft × Show-Start × iveo × Master folgt × „unklar“ × Stimme an × trotzdem (${nX} Fälle)${abwX.length ? ` — ${abwX.slice(0, 3).join('; ')}` : ''}`,
    nX === 256 && abwX.length === 0);

  // Speicher in der Sprechblase (G7, G8, EP23): merkt der Rechner nichts, sagt es die Blase — auch am Neustart-Schritt.
  const basis = anleitungAnsicht(EINRICHTUNG, { ...leererFortschritt(EINRICHTUNG.id), status: 'laeuft', position: { ort: 'einleitung' } }, {},
    anleitungsUmgebung({ produktion: false, produktionUnklar: false, stimmeAn: true, stimmeTrotzdem: false }, true));
  const mitHinweis = { ...basis, blase: basis.blase === null ? null : { ...basis.blase, wiederfinden: 'W.' } };
  const ohneBlase = { ...basis, blase: null };
  let nS = 0;
  const abwS: string[] = [];
  for (const speicher of ['ok', 'leer', 'kaputt', 'nichtLesbar', 'nichtSchreibbar', 'neuer'] as const) {
    const merkt = speicher === 'ok' || speicher === 'leer' || speicher === 'kaputt';
    for (const [name, a, soll] of [['ohne Hinweis', basis, merkt ? null : 'U26'], ['mit Hinweis', mitHinweis, merkt ? 'W.' : 'W. U26'], ['ohne Blase', ohneBlase, undefined]] as const) {
      nS++;
      const ist = launcherBlase(a, { produktionUnklar: false, speicher }, { stimmeWartet: 'L15', nichtGemerkt: 'U26' }).blase?.wiederfinden;
      if (ist !== soll) abwS.push(`${speicher}/${name}: ${ist}`);
    }
  }
  ck(`P14 G7, G8, EP23: merkt der Rechner den Fortschritt nicht (nicht lesbar, nicht schreibbar, neuere Fassung), steht U26 in der Sprechblase (${nS} Fälle)${abwS.length ? ` — ${abwS.join('; ')}` : ''}`,
    nS === 18 && abwS.length === 0);

  const L15 = 'Die Stimme wartet noch kurz: Ob gerade eine Produktion läuft, sehe ich erst ein paar Sekunden nach dem Start des Launchers.';
  ck('P14 9.3, EP24: L15 wörtlich in LAUNCHER_ANLEITUNG_TEXTE (ohne ASCII-Anführungszeichen)',
    LAUNCHER_ANLEITUNG_TEXTE.stimmeWartet === L15 && !L15.includes('"'));

  // Verdrahtung der Hülle (Quelltext-Wächter; components/Anleitung.tsx lädt React und die Ansagen und läuft hier nicht).
  const huelle = quelleLfOderLeer('../src/renderer/src/components/Anleitung.tsx');
  const app = quelleLf('../src/renderer/src/App.tsx');
  const store = quelleLfOderLeer('../src/renderer/src/store/anleitung.ts');
  const zWert = (k: string): number => Number(k.replace(/^z-\[?/, '').replace(/\]$/, ''));
  const andere: number[] = [];
  for (const datei of readdirSync(new URL('../src/renderer/src/components/', import.meta.url))) {
    if (!datei.endsWith('.tsx') || datei === 'Anleitung.tsx') continue;
    for (const m of quelleLf(`../src/renderer/src/components/${datei}`).matchAll(/fixed inset-0\b[^"]*?\b(z-\[\d+\]|z-\d+)/g)) andere.push(zWert(m[1]));
  }
  const eigen = /className="pointer-events-none fixed inset-0 (z-\[\d+\])"/.exec(huelle)?.[1];
  const meldung = /\{notice && \(\s*<div className="[^"]*\b(z-\[\d+\])/.exec(app)?.[1];
  ck(`P14 EP11: die Anleitung liegt über allen Dialogen und dem Lade-Overlay (bis z-${Math.max(...andere)}), unter der Meldung, ohne Klickfläche`,
    eigen !== undefined && meldung !== undefined && zWert(eigen) > Math.max(...andere) && zWert(eigen) < zWert(meldung));
  ck('P14 EP11: <Anleitung /> hängt in App.tsx direkt nach <ShowLaunchOverlay />, die Sprechblase mit noDragRegion',
    /<ShowLaunchOverlay \/>\n\s*<Anleitung \/>/.test(app) && app.includes("import { Anleitung } from '@/components/Anleitung';")
    && huelle.includes('blasenStil={noDragRegion}'));
  const ui = (ordner: string): string[] =>
    readdirSync(new URL(`../../../packages/ui/src/${ordner}/`, import.meta.url)).map((f) => `../../../packages/ui/src/${ordner}/${f}`);
  const dateien = [
    '../src/renderer/src/components/Anleitung.tsx', '../src/renderer/src/store/anleitung.ts', '../src/renderer/src/lib/anleitung-zustand.ts',
    ...readdirSync(new URL('../src/renderer/src/anleitung/', import.meta.url)).filter((f) => f.endsWith('.ts')).map((f) => `../src/renderer/src/anleitung/${f}`),
    ...ui('lib').filter((p) => /\/(anleitung[^/]*\.ts|useAnsage\.ts|useAnleitungsZiel\.ts)$/.test(p)),
    ...ui('components').filter((p) => /\/Anleitung[^/]*\.tsx$/.test(p)),
  ];
  const befunde = dateien.flatMap((p) => g3Befunde(quelleLfOderLeer(p)).map((x) => `${p.split('/').pop()}: ${x}`));
  ck(`P14 G3: kein Anleitungs-Code bedient etwas, startet etwas oder öffnet einen Dialog (${dateien.length} Dateien)${befunde.length ? ` — ${befunde.join(', ')}` : ''}`,
    dateien.length === 11 && dateien.every((p) => quelleLfOderLeer(p).length > 0) && befunde.length === 0);
  ck('P14 G15, EP17, EP23, EP24: die Hülle reicht Produktion, „unklar“, Stimme und Speicher aus dem Store an Umgebung und Blase',
    ['const produktion = useAnleitung((s) => s.produktion);', 'const produktionUnklar = useAnleitung((s) => s.produktionUnklar);',
      'const stimmeAn = useAnleitung((s) => s.stimmeAn);', 'const stimmeTrotzdem = useAnleitung((s) => s.stimmeTrotzdem);',
      'const speicher = useAnleitung((s) => s.speicher);',
      'const umgebung = anleitungsUmgebung({ produktion, produktionUnklar, stimmeAn, stimmeTrotzdem }, STIMME_VORHANDEN);',
      'return anleitungAnsicht(EINRICHTUNG, fortschritt, jetzt, umgebung);',
      'const gezeigt = launcherBlase(ansicht, { produktionUnklar, speicher }, { stimmeWartet: LAUNCHER_ANLEITUNG_TEXTE.stimmeWartet, nichtGemerkt: ANLEITUNG_TEXTE.speicherNichtSchreibbar });',
      'ansicht={gezeigt}'].every((z) => huelle.includes(z)));
  ck('P14 6, G15: „Stimme trotzdem an“ geht an den Treiber (nur bis zum Ende der Produktion) und wird nie gemerkt; gemerkt wird nur an/aus je Rechner',
    store.includes('    stimmeTrotzdemAn: () => treiber.stimmeTrotzdemAn(),') && (store.match(/setItem\(/g) ?? []).length === 1
    && store.includes("launcherSpeicher()?.setItem(STIMME_SCHLUESSEL, an ? 'an' : 'aus');"));
  ck('P14 6, EP15: die Ansage spielt über useAnsage mit der Datei aus dem Manifest, nur wenn die gezeigte Blase es erlaubt',
    huelle.includes('const fehler = useAnsage(id ? ansageUrl(id) : null, id, spielen);')
    && huelle.includes('const spielen = gezeigt.blase?.ansage.spielen ?? false;')
    && huelle.includes('stimme={{ vorhanden: STIMME_VORHANDEN, an: stimmeAn, fehler, umschalten: stimmeUmschalten, trotzdemAn: stimmeTrotzdemAn }}'));
  const ansage = funktionsKoerper(quelleLf('../../../packages/ui/src/lib/useAnsage.ts'), 'export function useAnsage(');
  ck('P14 6, G15: useAnsage stoppt die laufende Ansage, sobald spielen falsch wird (Effekt hängt an url, id und spielen)',
    ansage.includes('return starteAnsage(url, id, spielen, (u) => new Audio(u), (fehler) => setStand(ansageStand(id, fehler)));')
    && ansage.includes('  }, [url, id, spielen]);'));
  ck('P14 EP19: Steuerebene alle 5 s nachlesen, solange Sprechblase oder Kapitelübersicht offen sind',
    huelle.includes('const sichtbar = ansicht.blase !== null || onboardingOpen;')
    && huelle.includes('const t = setInterval(() => void ladeSteuerebene(), 5000);') && huelle.includes('return () => clearInterval(t);'));
}

// --- Geführte Anleitung P15 (Spec 4, OF1–OF3; EP8, EP20–EP22): Kapitelübersicht, Knopf „Erste Schritte“, kein Funktionsverlust ---
{
  const T = { knopf: L_TEXTE.knopf, knopfTitel: L_TEXTE.knopfTitel, neu: L_TEXTE.neu, fortsetzen: (n: number, m: number) => U_TEXTE.fortsetzen(EINRICHTUNG.titel, n, m) };
  const faelle: Array<{ fortsetzen: { n: number; m: number } | null; hinweis: boolean }> = [];
  for (const fortsetzen of [null, { n: 1, m: 6 }, { n: 3, m: 6 }, { n: 6, m: 6 }]) for (const hinweis of [false, true]) faelle.push({ fortsetzen, hinweis });
  // Erwartung wörtlich aus der Texttabelle (U12, L11, L12): ein falscher Text in @jm/ui oder der Anleitungs-Datei fällt hier auf.
  const soll = (a: { fortsetzen: { n: number; m: number } | null; hinweis: boolean }) => {
    const text = a.fortsetzen ? `Einrichtung fortsetzen · Schritt ${a.fortsetzen.n} von ${a.fortsetzen.m}` : a.hinweis ? 'Neu: geführte Einrichtung' : null;
    return { text, aria: text === null ? 'Erste Schritte' : `Erste Schritte: ${text}`, title: 'Erste Schritte · geführte Einrichtung' };
  };
  const abw = faelle.filter((a) => JSON.stringify(ersteSchritteKnopf(a, T)) !== JSON.stringify(soll(a)));
  ck(`P15 4, OF2: Knopf „Erste Schritte“ — Text, aria-label und title in jedem Zustand (${faelle.length} Fälle)${abw.length
    ? ` — ${abw.slice(0, 3).map((a) => `${JSON.stringify(a)} → ${JSON.stringify(ersteSchritteKnopf(a, T))}`).join('; ')}` : ''}`, abw.length === 0);

  // „Erste Schritte“ an jedem Ort der Anleitung (Spec 4, EP8, EP20; D17): Treiber aus Task 12, echte Ansicht und Knopf. Danach
  // liegt keine Sprechblase über der Übersicht, und der Knopf stimmt — an der Rückfrage zurück zur Einleitung und pausiert, am
  // Abschluss wie „Weiter“ (nichts mehr fortzusetzen), „Zeig mir“ endet, der Hinweis endet.
  const UMGEBUNG = { produktion: false, stimme: { vorhanden: true, an: true, trotzdem: false } };
  const zuSechs = (art: string): Array<Record<string, unknown>> => ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((kapitel) => ({ art, kapitel }));
  const ORTE: Array<[string, boolean, Array<Record<string, unknown>>, string | null]> = [
    ['Einleitung (von selbst gestartet)', false, [], 'Einrichtung fortsetzen · Schritt 1 von 6'],
    ['Rückfrage', false, [{ art: 'anleitungUeberspringen' }], 'Einrichtung fortsetzen · Schritt 1 von 6'],
    ['Kapitel 3', false, [{ art: 'weiter' }, { art: 'ueberspringen' }, { art: 'ueberspringen' }], 'Einrichtung fortsetzen · Schritt 3 von 6'],
    ['Abschluss mit offenen Kapiteln', false, [{ art: 'weiter' }, ...zuSechs('x').map(() => ({ art: 'ueberspringen' }))], null],
    ['Abschluss, alle Kapitel nicht gebraucht', false, [...zuSechs('brauchtNicht'), { art: 'weiter' }], null],
    ['„Zeig mir“ bei pausierter Anleitung', false,
      [{ art: 'weiter' }, { art: 'ueberspringen' }, { art: 'ueberspringen' }, { art: 'spaeter' }, { art: 'starten', kapitel: 'k5' }], 'Einrichtung fortsetzen · Schritt 3 von 6'],
    ['bestehender Rechner mit Hinweis', true, [], null],
  ];
  const ortAbw: string[] = [];
  for (const [name, bestehend, folge, soll] of ORTE) {
    const { t, lage } = treiberMit(speicherAttrappe());
    t.starte({ bestehenderRechner: bestehend });
    for (const e of folge) t.ereignis(e as AnleitungsEreignis);
    const vorher = lage.stand.fortschritt.einzeln !== null ? 'Zeig mir' : lage.stand.fortschritt.position?.ort ?? lage.stand.fortschritt.status;
    t.zurUebersicht();
    const a = anleitungAnsicht(EINRICHTUNG, lage.stand.fortschritt, lage.stand.jetzt, UMGEBUNG);
    const knopf = ersteSchritteKnopf({ fortsetzen: a.fortsetzen, hinweis: lage.stand.hinweis }, T);
    if (a.blase !== null || knopf.text !== soll) {
      ortAbw.push(`${name} (${vorher}): ${a.blase === null ? 'keine Blase' : `Blase ${a.blase.art}`}, Knopf ${knopf.text ?? 'nur Symbol'}`);
    }
  }
  ck(`P15 4, EP20: „Erste Schritte“ an jedem Ort — danach keine Sprechblase über der Übersicht und der Knopf stimmt (${ORTE.length} Fälle)${ortAbw.length ? ` — ${ortAbw.join('; ')}` : ''}`,
    ortAbw.length === 0);

  const modal = quelleLf('../src/renderer/src/components/OnboardingModal.tsx');
  const kopf = quelleLf('../src/renderer/src/components/Header.tsx');
  const picker = quelleLf('../src/renderer/src/components/ScenarioPicker.tsx');
  const reiter = quelleLf('../src/renderer/src/components/ShowView.tsx');
  const tools = quelleLf('../src/renderer/src/store/tools.ts');
  const store = quelleLfOderLeer('../src/renderer/src/store/anleitung.ts');
  const { createHash } = await import('node:crypto');
  const szenarienHash = createHash('sha256').update(quelleLf('../src/renderer/src/lib/scenarios.ts')).digest('hex');
  // Kein Funktionsverlust (Lehre; Ist-L 4.1 Checkliste, 4.2 Szenario-Auswahl): je Zeile ein Wächter.
  const tabelle: Array<[string, boolean]> = [
    ['Checkliste 1 Release-Quelle: „Einrichten/Ändern“ öffnet die Einstellungen, Detail „Aktiv: …“ (L5, L9)',
      modal.includes('k1: { knopf: L.aktion.k1(fertig.k1), ausfuehren: openSettings },') && modal.includes('kapitelDetails({ ...useAnleitung.getState().eingang(), settings, states }, L.detail)')],
    ['Checkliste 2 Werkzeuge: „Auswählen/Werkzeugkasten“ schließt und wechselt in den Werkzeugkasten, Zahl der Tools (L6, L10)',
      modal.includes("k2: { knopf: L.aktion.k2(fertig.k2), ausfuehren: () => { close(); setView('catalog'); } },")],
    ['Checkliste 3 Netzwerk & Steuerebene: „Prüfen“ öffnet den System-Zustand (L8)', modal.includes('k5: { knopf: L.aktion.k5, ausfuehren: openSystem },')],
    ['Checkliste 4 Erste Show aus Vorlage: „Vorlage wählen“ öffnet die Szenario-Auswahl (L8)', modal.includes('k4: { knopf: L.aktion.k4, ausfuehren: openScenarios },')],
    ['Checkliste Kopf und Fuß: Titel, Unterzeile, Tipp Kochbuch, „Fertig“ und Schließen-Kreuz (L13, L14, U35)',
      ['titel={L.titel}', 'unterzeile={L.unterzeile}', 'tipp={L.tipp}', 'schliessen={close}', 'aria-label={L.schliessen}', 'onClick={close}'].every((t) => modal.includes(t))],
    ['Checkliste Ebene z-40 unter den Detail-Dialogen: die Übersicht bleibt Rücksprung-Ebene', modal.includes('<div className="fixed inset-0 z-40 ')],
    ['Checkliste Haken live: aus dem Kapitelzustand der Anleitung (G7), nicht mehr aus eigener Rechnung',
      modal.includes('const ansicht = useAnleitungsAnsicht();') && modal.includes('ansicht={ansicht}') && !modal.includes('sourceDone')],
    ['Knopf „Erste Schritte“ im Kopf öffnet weiter die Übersicht', kopf.includes('onClick={openOnboarding}')],
    ['Szenario-Auswahl: vier Vorlagen, „Los“ öffnet den Show-Editor mit der Vorlage',
      picker.includes('const startWith = useTools((s) => s.openShowEditorWith);') && /Los\s*<\/Button>/.test(picker)
      && SZENARIEN.map((s) => s.id).join(',') === 'konferenz,battle,buehne,podcast'],
    ['Einstieg „Aus Vorlage starten“ im Reiter JM Show', reiter.includes("title: 'Aus Vorlage starten',") && reiter.includes('onClick: openScenarios,')],
    [`lib/scenarios.ts unverändert (SHA-256 nach LF wie vor dem Plan, ist ${szenarienHash.slice(0, 12)}…)`,
      szenarienHash === '71270905b755101b0bd00e82bb5533f3db128bf5f3862f580ceea880fb267b09'],
  ];
  for (const [zeile, gut] of tabelle) ck(`P15 kein Funktionsverlust: ${zeile}`, gut);

  ck('P15 Ist-M 15: kein ASCII-Schlusszeichen und kein Text der alten Checkliste mehr in OnboardingModal.tsx',
    !/„[^“\n]*"/.test(modal) && !modal.includes('In vier Schritten startklar') && !modal.includes('function Step('));
  const oeffnen = funktionsKoerper(tools, 'openOnboarding: () => {');
  ck('P15 EP8, EP20: „Erste Schritte“ übergibt zuerst an den Treiber (pausieren, „Zeig mir“ beenden, Hinweis aus), dann öffnet die Übersicht',
    oeffnen.includes('useAnleitung.getState().zurUebersicht();') && store.includes('    zurUebersicht: () => treiber.zurUebersicht(),')
    && oeffnen.indexOf('zurUebersicht();') < oeffnen.indexOf('set({ onboardingOpen: true });'));
  ck('P15 EP20: Schließen merkt nichts; Starten und „Zeig mir“ schließen die Übersicht, damit die Hervorhebung frei liegt',
    tools.includes('  closeOnboarding: () => void;') && tools.includes('    closeOnboarding: () => set({ onboardingOpen: false }),')
    && modal.includes("if (e.art === 'starten') close();"));
  ck('P15 G7: jede Diagnose des Speichers steht in der Übersicht (U25–U28), ok und leer ohne Zeile',
    ['ok: null,', 'leer: null,', 'nichtLesbar: ANLEITUNG_TEXTE.speicherNichtLesbar,', 'nichtSchreibbar: ANLEITUNG_TEXTE.speicherNichtSchreibbar,',
      'kaputt: ANLEITUNG_TEXTE.speicherKaputt,', 'neuer: ANLEITUNG_TEXTE.speicherNeuer,'].every((t) => modal.includes(t))
    && modal.includes('speicherHinweis={SPEICHER_HINWEIS[speicher]}'));
  ck('P15 6, EP21: Stimmen-Schalter mit Namensnennung in der Übersicht',
    modal.includes('stimme={{ vorhanden: STIMME_VORHANDEN, an: stimmeAn, umschalten: stimmeUmschalten, namensnennung: NAMENSNENNUNG }}'));
  ck('P15 4, OFP3: der Kopf zeigt Text, aria-label und title aus ersteSchritteKnopf (voller Text, kein Umbruch)',
    kopf.includes('aria-label={ersteSchritte.aria}') && kopf.includes('title={ersteSchritte.title}')
    && kopf.includes('{ersteSchritte.text && <span>{ersteSchritte.text}</span>}')
    && kopf.includes("'flex items-center gap-1.5 px-2.5 whitespace-nowrap text-xs font-semibold'")
    && kopf.includes('const { fortsetzen } = useAnleitungsAnsicht();') && kopf.includes('const hinweis = useAnleitung((s) => s.hinweis);'));
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
