// Anmeldung im Launcher, Admin-Maske (Plan P26, P27): Zeilen, Formulare, Fehlertexte und Texte der Reiter — reine Funktionen
// aus lib/admin-ansicht.ts, mit Kreuzprodukten (G7, G12). Ohne Electron, ohne Fenster:
//   npm run selftest:konto -w @jm/launcher   (tsx; Form „ck“)
import { readFileSync } from 'node:fs';
import type { AdminUebersicht, AdminZugang, KontoAnsicht, KontoFehlerCode, KontoStand, KontoZustand, Stufe } from '../src/shared/konto';
import {
  ADMIN_TEXTE, adminKnopfSichtbar, einladeFormular, einladungsAnzeige, fehlerText, feldDatum, formularAusZugang, ladeFehlerText,
  loeschFrage, verlaengertBis, zugangDetails, zugangFormular, zugangZeilen,
} from '../src/renderer/src/lib/admin-ansicht';
import { datumText } from '../src/renderer/src/lib/konto-anzeige';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
/** Kreuzprodukt als EINE Testzeile (G12): bei Abweichung die ersten fünf Fälle mit ist/soll. */
function kreuz(name: string, faelle: Array<[string, string, string]>): void {
  const abw = faelle.filter(([, ist, soll]) => ist !== soll);
  ck(`${name} (${faelle.length} Fälle)${abw.length ? ` — ${abw.length} abweichend: ${abw.slice(0, 5).map(([f, ist, soll]) => `${f}: ist ${ist} / soll ${soll}`).join('; ')}` : ''}`,
    abw.length === 0);
}

const JETZT = new Date(2026, 9, 21, 10, 0, 0).getTime();
const TAG = 86_400_000;
/** Zeitpunkt in Ortszeit lesbar (die Ausgabe hängt so nicht von der Zeitzone ab). */
function zeit(ms: number | null): string {
  if (ms === null) return 'null';
  const d = new Date(ms);
  const p = (n: number, l = 2): string => String(n).padStart(l, '0');
  return `${datumText(ms)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
function zugang(extra: Partial<AdminZugang> = {}): AdminZugang {
  return {
    kid: 'k1', email: 'ext@partner.de', name: 'Ext Erna', art: 'passwort', stufe: 'externer', zustand: 'aktiv', tools: ['qa'], events: [],
    bis: JETZT + 30 * TAG, zoomBis: null, einladungBis: null, letzteAnmeldung: null, ersterAdmin: false, ...extra,
  };
}
function uebersicht(zugaenge: AdminZugang[]): AdminUebersicht {
  return { zugaenge, iveo: [], anfragen: [], geraete: [], altKey: { bis: null, diagnose: 'ohne-ende', zeilen: [] } };
}
function stand(stufe: Stufe): KontoStand {
  return {
    kid: 'k1', email: 'maria@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe, tools: [], events: [], zoom: true,
    zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: JETZT - 1000, exp: JETZT + 29 * TAG, kontoBis: null, angemeldetSeit: JETZT - TAG,
  };
}
function ansicht(zustand: KontoZustand, s: KontoStand | null): KontoAnsicht {
  return {
    zustand, stand: s, grund: null, gueltigBis: s?.exp ?? null, rechnerName: 'REGIE-01', plattform: 'win', hinweise: [], devVariablen: [],
    zoomAnfrage: null, adminOffen: 0, ausgaben: [], letztePruefung: null,
  };
}

// --- P26 7, EP15, OFP4: „Admin-Maske öffnen“ nur für Admins mit gültiger Sitzung -----------------------------------------
{
  const faelle: Array<[string, string, string]> = [];
  const zustaende: KontoZustand[] = ['nicht-angemeldet', 'pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'abgelaufen', 'entzogen', 'entzogen-laeuft', 'kein-schluesselspeicher'];
  const mitSitzung: KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];
  for (const z of zustaende) for (const st of [null, 'admin', 'kollege', 'externer'] as const) {
    faelle.push([`${z}/${st ?? '-'}`, String(adminKnopfSichtbar(ansicht(z, st === null ? null : stand(st)))), String(st === 'admin' && mitSitzung.includes(z))]);
  }
  faelle.push(['vor dem Laden', String(adminKnopfSichtbar(null)), 'false']);
  kreuz('P26 7, EP15: Admin-Maske nur für Admins mit gültiger Sitzung (Zustand × Stufe)', faelle);
}

// --- P26 7: Zeilen der Liste „Zugänge“ (M10, M11) -----------------------------------------------------------------------------
{
  const u = uebersicht([
    zugang({ kid: 'a', name: 'Zora Zeh', stufe: 'kollege', art: 'google', email: 'zora@jakobsmedien.com', bis: null, tools: [] }),
    zugang({ kid: 'b', name: 'Anna Alt', bis: JETZT - TAG }),
    zugang({ kid: 'c', name: 'Bert Block', zustand: 'gesperrt', art: 'google', stufe: 'kollege', email: 'bert@jakobsmedien.com', bis: null }),
    zugang({ kid: 'd', name: 'Carla Code', einladungBis: JETZT + 2 * TAG }),
    zugang({ kid: 'e', name: 'Chef Erst', stufe: 'admin', art: 'google', email: 'chef@jakobsmedien.com', bis: null, ersterAdmin: true }),
    zugang({ kid: 'f', name: 'Dora Dauer', einladungBis: JETZT - TAG }),
  ]);
  const zeilen = zugangZeilen(u, JETZT).map((z) => `${z.name}|${z.stufe}|${z.bis}|${z.merkmale.join(',')}`);
  kreuz('P26 7: Zeilen nach Name mit Stufe, bis und Merkmalen (gesperrt, abgelaufen, Einladung offen, erster Admin)', [
    ['Reihenfolge und Inhalt', zeilen.join(' / '), [
      `Anna Alt|Externer|${datumText(JETZT - TAG)}|abgelaufen`,
      'Bert Block|Kollege||gesperrt',
      `Carla Code|Externer|${datumText(JETZT + 30 * TAG)}|Einladung offen`,
      'Chef Erst|Admin||erster Admin',
      `Dora Dauer|Externer|${datumText(JETZT + 30 * TAG)}|`,
      'Zora Zeh|Kollege||',
    ].join(' / ')],
    ['leer', String(zugangZeilen(uebersicht([]), JETZT).length), '0'],
  ]);
  const det = (z: AdminZugang): string => zugangDetails(z, (k) => (k === 'base|cop31' ? 'COP31' : k), JETZT).map((d) => `${d.bezeichner}=${d.wert}`).join('; ');
  kreuz('P26 7, 5: Details M12–M14 (Tools, Events und Zoom nur bei Externen)', [
    ['Externer', det(zugang({ tools: ['connect-raum', 'qa', 'iveo'], events: ['base|cop31'], zoomBis: JETZT + 3 * TAG })),
      `Anmeldeart=E-Mail und Passwort; Stufe=Externer; Tools=Connect (Cloud-Raum), Q&A (Cloud-Relay), iveo im Launcher; iveo-Events=COP31; Zugang bis=${datumText(JETZT + 30 * TAG)}; Zoom-Freigabe bis=Connect (Zoom, nur über Anfrage): freigegeben bis ${datumText(JETZT + 3 * TAG)}`],
    ['Externer ohne Zoom', det(zugang({ zoomBis: JETZT - TAG })), `Anmeldeart=E-Mail und Passwort; Stufe=Externer; Tools=Q&A (Cloud-Relay); iveo-Events=; Zugang bis=${datumText(JETZT + 30 * TAG)}; Zoom-Freigabe bis=Connect (Zoom, nur über Anfrage): nicht freigegeben`],
    ['Kollege', det(zugang({ stufe: 'kollege', art: 'google', bis: null })), 'Anmeldeart=Google-Firmenkonto; Stufe=Kollege; Zugang bis='],
  ]);
}

// --- P26 7, 5, EP15: Formular → Aktion; Einladen ---------------------------------------------------------------------------------
{
  const f = (kid: string, form: Parameters<typeof zugangFormular>[1]): string => {
    const r = zugangFormular(kid, form);
    return 'fehler' in r ? `fehler|${r.fehler}` : r.aktion === 'zugang-speichern'
      ? `${r.aktion}|${r.stufe}|${r.tools.join(',')}|${r.events.join(',')}|${zeit(r.bis)}|${zeit(r.zoomBis)}` : r.aktion;
  };
  kreuz('P26 7, EP15: Formular → Aktion (Externer ohne bis M27, Tagesende, Tools/Events/Zoom nur bei Externen)', [
    ['Externer ohne bis', f('k1', { stufe: 'externer', tools: ['qa'], events: [], bis: '', zoomBis: '' }), `fehler|${ADMIN_TEXTE.bisFehlt}`],
    ['Externer mit bis und Zoom', f('k1', { stufe: 'externer', tools: ['qa', 'iveo'], events: ['b|e'], bis: '2026-12-31', zoomBis: '2026-11-15' }),
      'zugang-speichern|externer|qa,iveo|b|e|31.12.2026 23:59:59.999|15.11.2026 23:59:59.999'],
    ['zum Kollegen gemacht', f('k1', { stufe: 'kollege', tools: ['qa'], events: ['b|e'], bis: '', zoomBis: '2026-11-15' }), 'zugang-speichern|kollege|||null|null'],
    ['Kollege mit bis', f('k1', { stufe: 'kollege', tools: [], events: [], bis: '2027-01-31', zoomBis: '' }), 'zugang-speichern|kollege|||31.01.2027 23:59:59.999|null'],
    ['Admin', f('k1', { stufe: 'admin', tools: ['qa'], events: [], bis: '', zoomBis: '' }), 'zugang-speichern|admin|||null|null'],
    ['ungültiges Datum', f('k1', { stufe: 'kollege', tools: [], events: [], bis: '2026-02-30', zoomBis: '' }), `fehler|${ADMIN_TEXTE.ungueltig}`],
  ]);
  const z = formularAusZugang(zugang({ bis: new Date(2026, 11, 31, 23, 59, 59, 999).getTime(), zoomBis: null, tools: ['qa'], events: ['b|e'] }));
  ck('P26 EP15: Formular aus dem Zugang — Datumsfelder in Ortszeit (JJJJ-MM-TT), Listen kopiert',
    JSON.stringify(z) === JSON.stringify({ stufe: 'externer', tools: ['qa'], events: ['b|e'], bis: '2026-12-31', zoomBis: '' })
    && feldDatum(null) === '' && verlaengertBis(new Date(2026, 9, 21, 10).getTime()) === '2026-11-20');
  const e = (form: Parameters<typeof einladeFormular>[0]): string => {
    const r = einladeFormular(form);
    return 'fehler' in r ? `fehler|${r.fehler}` : r.aktion === 'einladen' ? `${r.aktion}|${r.email}|${r.name}|${r.tools.join(',')}|${zeit(r.bis)}` : r.aktion;
  };
  kreuz('P26 4: Einladen (jakobsmedien.com → M28, ohne bis → M27, sonst bis Tagesende, E-Mail klein)', [
    ['Domain', e({ email: 'Neu@JakobsMedien.com', name: 'X', tools: [], events: [], bis: '2026-12-31' }), `fehler|${ADMIN_TEXTE.domain}`],
    ['ohne bis', e({ email: 'neu@partner.de', name: 'X', tools: [], events: [], bis: '' }), `fehler|${ADMIN_TEXTE.bisFehlt}`],
    ['gut', e({ email: ' Neu@Partner.de ', name: ' Nora Neu ', tools: ['qa'], events: [], bis: '2026-12-31' }), 'einladen|neu@partner.de|Nora Neu|qa|31.12.2026 23:59:59.999'],
  ]);
  kreuz('P26 4: Rückfrage vor dem Löschen — Google wird gesperrt (M17, Ja, sperren), Externe gelöscht (M18, Ja, löschen)', [
    ['Google', JSON.stringify(loeschFrage(zugang({ art: 'google' }))), JSON.stringify({ text: ADMIN_TEXTE.frageLoeschenGoogle, ja: 'Ja, sperren' })],
    ['Externer', JSON.stringify(loeschFrage(zugang())), JSON.stringify({ text: ADMIN_TEXTE.frageLoeschenExtern, ja: 'Ja, löschen' })],
  ]);
  kreuz('P26 4: Einladungscode nur aus dem Ergebnis der Aktion, mit Frist (M22, M23)', [
    ['mit Code', JSON.stringify(einladungsAnzeige('Nora Neu', { ok: true, einladungscode: 'K7MQ-2X4P-9RTA', codeBis: JETZT + 3 * TAG })),
      JSON.stringify({ code: 'Einladungscode für Nora Neu: K7MQ-2X4P-9RTA', hinweis: `Der Code wird nur jetzt angezeigt. Gib ihn Nora Neu auf eigenem Weg (z. B. Chat). Er gilt bis ${datumText(JETZT + 3 * TAG)} und nur einmal.` })],
    ['ohne Code', JSON.stringify(einladungsAnzeige('Nora Neu', { ok: true })), 'null'],
    ['ohne Ergebnis', JSON.stringify(einladungsAnzeige('Nora Neu', null)), 'null'],
  ]);
}

// --- P26 EP17: Fehlercode → Text (je Aktion) ----------------------------------------------------------------------------------
{
  const CODES: KontoFehlerCode[] = ['netz', 'server', 'nicht-eingerichtet', 'zu-viele', 'nicht-angemeldet', 'sitzung-abgelaufen', 'kein-recht',
    'gesperrt', 'geloescht', 'zugang-abgelaufen', 'geraet-unbekannt', 'vorgang-unbekannt', 'ungueltig', 'konflikt', 'nicht-noetig',
    'unbekannter-zweck', 'erster-admin', 'domain'];
  const SOLL: Record<KontoFehlerCode, string> = {
    netz: 'Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.',
    server: 'Beim Server ist etwas schiefgegangen. Versuche es in ein paar Minuten erneut.',
    'nicht-eingerichtet': 'Die Anmeldung ist auf dem Server noch nicht eingerichtet.',
    'zu-viele': 'Zu viele Anmeldeversuche von diesem Anschluss. Versuche es in ein paar Minuten erneut.',
    'nicht-angemeldet': 'Anmeldung abgelaufen. Klicke, um dich neu anzumelden.',
    'sitzung-abgelaufen': 'Anmeldung abgelaufen. Klicke, um dich neu anzumelden.',
    'kein-recht': 'Du bist kein Admin mehr. Die Admin-Maske ist geschlossen.',
    gesperrt: 'Zugang gesperrt', geloescht: 'Zugang gelöscht', 'zugang-abgelaufen': 'Zugang abgelaufen',
    'geraet-unbekannt': 'dieser Rechner ist dem Server unbekannt', 'vorgang-unbekannt': 'ungültige Anfrage', ungueltig: 'ungültige Anfrage',
    konflikt: 'Es muss immer mindestens einen Admin geben.', 'nicht-noetig': 'Zoom ist für deine Stufe schon erlaubt',
    'unbekannter-zweck': 'unbekannter Zweck', 'erster-admin': 'Der erste Admin (Eintrag beim Worker) lässt sich hier nicht ändern.',
    domain: 'Kollegen von jakobsmedien.com melden sich mit Google an; für sie braucht es keine Einladung.',
  };
  const faelle: Array<[string, string, string]> = CODES.map((c) => [c, fehlerText(c, 'zugang-speichern'), SOLL[c]]);
  faelle.push(['konflikt beim Einladen', fehlerText('konflikt', 'einladen'), 'Diese E-Mail hat schon einen Zugang.']);
  faelle.push(['M4 mit Grund', ladeFehlerText('netz'), 'Die Admin-Maske konnte nicht geladen werden: Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.']);
  kreuz('P26 EP17: Fehlercode → Text (jeder Code, konflikt je Aktion: M24 bzw. M26; M4 beim Laden)', faelle);
}

// --- P26 9.4: Texte M1–M29 wörtlich, ohne ASCII-Anführungszeichen ----------------------------------------------------------
{
  const T = ADMIN_TEXTE;
  kreuz('P26 9.4: M1–M29, M48 wörtlich', [
    ['M1', `${T.titel} / ${T.oeffnen}`, 'Admin-Maske / Admin-Maske öffnen'],
    ['M2', Object.values(T.reiter).join(' / '), 'Zugänge / iveo-Events / Anfragen / Geräte'],
    ['M4', `${T.laedt} / ${T.ladeFehler('G')} / ${T.neuLaden}`, 'Lade … / Die Admin-Maske konnte nicht geladen werden: G. / Erneut laden'],
    ['M5', T.keinAdmin, 'Du bist kein Admin mehr. Die Admin-Maske ist geschlossen.'],
    ['M10', `${T.spalteName} / ${T.spalteStufe} / ${T.spalteBis}`, 'Name / Stufe / bis'],
    ['M11', `${T.gesperrt} / ${T.abgelaufen} / ${T.einladungOffen} / ${T.ersterAdmin}`, 'gesperrt / abgelaufen / Einladung offen / erster Admin'],
    ['M12', [T.anmeldeart, T.stufe, T.tools, T.events, T.zugangBis, T.zoomBis].join(' / '), 'Anmeldeart / Stufe / Tools / iveo-Events / Zugang bis / Zoom-Freigabe bis'],
    ['M13', Object.values(T.werkzeug).join(' / '), 'Connect (Cloud-Raum) / Q&A (Cloud-Relay) / iveo im Launcher'],
    ['M14', `${T.zoomFrei('D')} / ${T.zoomNicht}`, 'Connect (Zoom, nur über Anfrage): freigegeben bis D / Connect (Zoom, nur über Anfrage): nicht freigegeben'],
    ['M15', [T.speichern, T.loeschen, T.entsperren, T.neuerCode, T.verlaengern].join(' / '), 'Speichern / Zugang löschen / Sperre aufheben / Neuen Code erzeugen / Verlängern'],
    ['M16', T.gespeichert('N'), 'Gespeichert. Wirkt beim nächsten Start des Launchers von N.'],
    ['M19', T.frageNeuerCode, 'Das bisherige Passwort gilt danach nicht mehr.'],
    ['M20', [T.jaSperren, T.jaLoeschen, T.jaNeuerCode, T.abbrechen].join(' / '), 'Ja, sperren / Ja, löschen / Ja, neuen Code erzeugen / Abbrechen'],
    ['M21', [T.einladen, `${T.feldEmail}, ${T.feldName}`, T.einladenKnopf].join(' / '), '+ Externen einladen / E-Mail, Name / Einladen'],
    ['M27', T.bisFehlt, 'Externe brauchen ein Datum für „Zugang bis“.'],
    ['M29', T.keineZugaenge, 'Noch keine Zugänge. Kollegen erscheinen nach ihrer ersten Anmeldung.'],
    ['M48 (Teil 1, EP34)', T.connectTeil1, 'Connect nutzt Cloud-Raum und Zoom-Freigabe erst mit einem kommenden Update; bis dahin gilt in Connect alles wie bisher.'],
  ]);
  const alle: string[] = [];
  const sammle = (x: unknown): void => {
    if (typeof x === 'string') alle.push(x);
    else if (typeof x === 'function') alle.push(String((x as (...a: string[]) => string)('A', 'B')));
    else if (x && typeof x === 'object') Object.values(x).forEach(sammle);
  };
  sammle(ADMIN_TEXTE);
  ck(`P26 G2: keine ASCII-Anführungszeichen in den Texten der Admin-Maske (${alle.length} Zeichenketten)`, alle.length >= 45 && alle.every((t) => !t.includes('"')));
  const q = readFileSync(new URL('../src/renderer/src/lib/admin-ansicht.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const importe = q.split('\n').filter((z) => /^import\b/.test(z));
  ck(`P26 G9: lib/admin-ansicht.ts — aus Aliasen nur import type, zur Laufzeit nur src/shared/konto.ts und die Nachbar-Bibliotheken (${importe.length} Import-Zeilen)`,
    importe.length >= 4 && importe.every((z) => z.startsWith('import type ') || /from '(\.\.\/\.\.\/\.\.\/shared\/konto|\.\/konto-anzeige|\.\/konto-dialog)';$/.test(z))
    && !/window\.|localStorage|from 'react'|from 'zustand'/.test(q));
}

// ── Ende der Fälle (Admin-Maske) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
