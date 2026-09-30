// Selbsttest der reinen Launcher-Helfer - ohne Electron, ohne Fenster:
//   node --experimental-strip-types test/selftest.ts
import { startShowTools } from '../src/main/show-launch.ts';
import { PresenceStore, gueltigerVerbund } from '../src/main/presence-store.ts';

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

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
