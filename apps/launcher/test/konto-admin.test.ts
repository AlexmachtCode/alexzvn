// Anmeldung im Launcher, Admin-Maske (Plan P26, P27): Zeilen, Formulare, Fehlertexte und Texte der Reiter — reine Funktionen
// aus lib/admin-ansicht.ts, mit Kreuzprodukten (G7, G12). Ohne Electron, ohne Fenster:
//   npm run selftest:konto -w @jm/launcher   (tsx; Form „ck“)
import { readFileSync } from 'node:fs';
import type { AdminUebersicht, AdminZugang, KontoAnsicht, KontoFehlerCode, KontoStand, KontoZustand, Stufe } from '../src/shared/konto';
import {
  ADMIN_TEXTE, adminKnopfSichtbar, einladeFormular, einladungsAnzeige, fehlerText, feldDatum, formularAusZugang, ladeFehlerText,
  loeschFrage, verlaengertBis, zugangDetails, zugangFormular, zugangZeilen,
  REITER_TEXTE, alteLauncherZeilen, altKeyText, anfrageFreigabe, anfrageZeilen, geraeteZeilen, iveoHinterlegen, iveoZeilen,
  adminNachAktion, loeschenSchliesstDetail, vorauswahlNachLaden,
} from '../src/renderer/src/lib/admin-ansicht';
import { datumText } from '../src/renderer/src/lib/konto-anzeige';
import { ANMELDE_TEXTE } from '../src/renderer/src/lib/konto-dialog';

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

// --- P27 6.4, EP13: Reiter „iveo-Events“ — Zeilen ohne Token, Hinterlegen mit Prüfung (M30–M35) ---------------------------
{
  // Selbst wenn eine Übersicht ein Token trüge (Fehler auf der Serverseite), zeigt die Zeile es nicht (6.4: nie wieder angezeigt).
  const mitLeck = uebersicht([]);
  mitLeck.iveo = [
    { key: 'https://app.my-iveo.de/api/v1|cop31', basis: 'https://app.my-iveo.de/api/v1', slug: 'cop31', name: 'COP31', am: JETZT - TAG, von: 'Maria S.', token: 'test-nie-zeigen' } as AdminUebersicht['iveo'][number],
    { key: 'https://app.my-iveo.de/api/v1|amb', basis: 'https://app.my-iveo.de/api/v1', slug: 'amb', name: 'Ambiente', am: JETZT, von: 'Ole', token: 'test-nie-zeigen' } as AdminUebersicht['iveo'][number],
  ];
  const zeilen = iveoZeilen(mitLeck);
  ck('P27 6.4: iveo-Zeilen nach Name mit Event, Basis, hinterlegt am, von — nie mit Token',
    JSON.stringify(zeilen.map((z) => `${z.event}|${z.am}|${z.von}`)) === JSON.stringify([`Ambiente|${datumText(JETZT)}|Ole`, `COP31|${datumText(JETZT - TAG)}|Maria S.`])
    && !JSON.stringify(zeilen).includes('test-nie-zeigen'));
  const ev = [{ slug: 'cop31', name: 'COP31' }, { slug: 'amb', name: 'Ambiente' }];
  const h = (e: Parameters<typeof iveoHinterlegen>[0]): string => {
    const r = iveoHinterlegen(e, 'https://app.my-iveo.de/api/v1');
    return 'fehler' in r ? `fehler|${r.fehler}` : r.aktion === 'iveo-hinterlegen' ? `${r.aktion}|${r.basis}|${r.events.map((x) => x.slug).join(',')}|${r.token === 'test-token' ? 'Token' : 'anderes'}` : r.aktion;
  };
  kreuz('P27 6.4, M35: Hinterlegen — Token nötig, mindestens ein Event, leere Basis = Standard dieses Rechners', [
    ['ohne Token', h({ basis: '', token: '  ', gewaehlt: ['cop31'], events: ev }), 'fehler|Füge das Token ein.'],
    ['ohne Event', h({ basis: '', token: 'test-token', gewaehlt: [], events: ev }), 'fehler|Wähle mindestens ein Event.'],
    ['Auswahl nicht in der Liste', h({ basis: '', token: 'test-token', gewaehlt: ['fremd'], events: ev }), 'fehler|Wähle mindestens ein Event.'],
    ['gut, Standard', h({ basis: ' ', token: ' test-token ', gewaehlt: ['amb'], events: ev }), 'iveo-hinterlegen|https://app.my-iveo.de/api/v1|amb|Token'],
    ['gut, eigene Basis', h({ basis: 'https://iveo.test/api/v1', token: 'test-token', gewaehlt: ['cop31', 'amb'], events: ev }), 'iveo-hinterlegen|https://iveo.test/api/v1|cop31,amb|Token'],
  ]);
}

// --- P27 8 (2–4): Reiter „Anfragen“ (M40–M42) ------------------------------------------------------------------------------
{
  const u = uebersicht([]);
  const anfrage = (id: string, jm: boolean, zustand: 'offen' | 'freigegeben' | 'abgelehnt', am: number): AdminUebersicht['anfragen'][number] => ({
    id, kid: 'k1', name: 'Ext Erna', email: 'ext@partner.de', zweck: 'Gala', von: new Date(2026, 10, 10).getTime(), bis: new Date(2026, 10, 12, 23, 59, 59, 999).getTime(),
    gid: 'g1', rechnerName: 'REGIE-01', jm, plattform: 'win', zustand, am,
  });
  u.anfragen = [anfrage('a2', false, 'offen', JETZT), anfrage('a1', true, 'offen', JETZT - TAG), anfrage('a3', true, 'abgelehnt', JETZT - 2 * TAG)];
  kreuz('P27 8: offene Anfragen, älteste zuerst, M40 mit JM-Rechner, Warnung M41 nur für Nicht-JM-Rechner, Feld vorbelegt mit dem Ende', [
    ['Zeilen', anfrageZeilen(u).map((z) => `${z.id}|${z.text}|${z.warnung}|${z.bisFeld}`).join(' / '), [
      'a1|Ext Erna · Gala · 10.11.2026 bis 12.11.2026 · REGIE-01 (JM-Rechner)|null|2026-11-12',
      'a2|Ext Erna · Gala · 10.11.2026 bis 12.11.2026 · REGIE-01 (kein JM-Rechner)|Achtung: kein JM-Rechner. Die Freigabe wirkt dort nicht.|2026-11-12',
    ].join(' / ')],
    ['keine offenen', String(anfrageZeilen(uebersicht([])).length), '0'],
  ]);
  const fr = (feld: string): string => {
    const r = anfrageFreigabe('a1', feld);
    return 'fehler' in r ? `fehler|${r.fehler}` : r.aktion === 'anfrage-freigeben' ? `${r.aktion}|${r.id}|${zeit(r.bis)}` : r.aktion;
  };
  kreuz('P27 8, EP15: „Freigeben bis …“ gilt bis Tagesende der Ortszeit', [
    ['gut', fr('2026-11-12'), 'anfrage-freigeben|a1|12.11.2026 23:59:59.999'],
    ['leer', fr(''), 'fehler|ungültige Anfrage'],
  ]);
}

// --- P27 7, OF2, OFP2, EP9: Reiter „Geräte“ (M43–M47) -----------------------------------------------------------------------
{
  const u = uebersicht([zugang({ kid: 'k9', name: 'Maria Schmidt' })]);
  u.geraete = [
    { gid: 'g1', name: 'REGIE-01', plattform: 'win', arch: 'x64', version: '0.18.0', jm: true, ersterKontakt: JETZT - 9 * TAG, letzterKontakt: new Date(2026, 9, 21, 8, 30).getTime(), letztesKonto: 'k9' },
    { gid: 'g2', name: 'MacBook-Ext', plattform: 'mac', arch: 'arm64', version: '0.18.0', jm: false, ersterKontakt: JETZT - TAG, letzterKontakt: new Date(2026, 9, 21, 9, 45).getTime(), letztesKonto: 'kx' },
  ];
  kreuz('P27 7: Geräte, zuletzt im Kontakt zuerst, mit Konto (Name), Kontakt (Datum und Uhrzeit), Version, Plattform, JM-Rechner', [
    ['Zeilen', geraeteZeilen(u).map((g) => `${g.rechner}|${g.konto}|${g.kontakt}|${g.version}|${g.plattform}|${g.jm}`).join(' / '),
      'MacBook-Ext|kx|21.10.2026 09:45|0.18.0|mac · arm64|false / REGIE-01|Maria Schmidt|21.10.2026 08:30|0.18.0|win · x64|true'],
    ['keine Geräte', String(geraeteZeilen(uebersicht([])).length), '0'],
  ]);
  const mitFrist = (bis: string | null, diagnose: 'ohne-ende' | 'unlesbar' | null): string => {
    const x = uebersicht([]);
    x.altKey = { bis, diagnose, zeilen: [] };
    return altKeyText(x);
  };
  kreuz('P27 EP9, M44: Frist des alten Schlüssels; ohne oder unlesbar als Diagnose „ohne Enddatum“', [
    ['mit Datum', mitFrist('2026-12-01', null), 'Alter Schlüssel angenommen bis 01.12.2026.'],
    ['ohne Ende', mitFrist(null, 'ohne-ende'), 'Alter Schlüssel ohne Enddatum angenommen.'],
    ['unlesbar', mitFrist('kaputt', 'unlesbar'), 'Alter Schlüssel ohne Enddatum angenommen.'],
  ]);
  const alt = uebersicht([]);
  alt.altKey.zeilen = [
    { tag: '2026-10-20', gruppe: 'katalog', plattform: 'win/x64', anzahl: 12, zuletzt: new Date(2026, 9, 20, 17, 5).getTime() },
    { tag: '2026-10-21', gruppe: 'qa', plattform: 'win/x64', anzahl: 3, zuletzt: new Date(2026, 9, 21, 9, 0).getTime() },
  ];
  kreuz('P27 OF2, OFP2: alte Launcher je Tag, Gruppe (M46) und Plattform, neueste zuerst, ohne IP (M45)', [
    ['Zeilen', alteLauncherZeilen(alt).join(' / '), '21.10.2026 · Q&A extern · win/x64: 3 Anfragen, zuletzt 09:00 / 20.10.2026 · Katalog und Updates · win/x64: 12 Anfragen, zuletzt 17:05'],
    ['keine', alteLauncherZeilen(uebersicht([])).join(' / '), 'Keine Anfragen mit dem alten Schlüssel.'],
  ]);
}

// --- Z2 Fixrunde 2 (AR94 N1): leerer Rechnername in der Admin-Maske → M51 „(kein Name gemeldet)“ ------------------------------
// Seit B27 meldet sich auch ein Rechner an, dessen Name nach der Erlaubnisliste leer ist; die Daten bleiben leer, nur die Anzeige
// fällt auf M51 zurück (der Wortlaut von B27 ohne „Rechner:“).
{
  const u = uebersicht([zugang({ kid: 'k9', name: 'Maria Schmidt' })]);
  const geraet = (gid: string, name: string, kontakt: number): AdminUebersicht['geraete'][number] => ({
    gid, name, plattform: 'win', arch: 'x64', version: '0.18.0', jm: true, ersterKontakt: JETZT - TAG, letzterKontakt: kontakt, letztesKonto: 'k9',
  });
  u.geraete = [geraet('g1', '', JETZT - 1000), geraet('g2', '   ', JETZT - 2000), geraet('g3', 'REGIE-01', JETZT - 3000)];
  const anfrage = (id: string, rechnerName: string, am: number): AdminUebersicht['anfragen'][number] => ({
    id, kid: 'k9', name: 'Maria Schmidt', email: 'maria@jakobsmedien.com', zweck: 'Gala', von: new Date(2026, 10, 10).getTime(),
    bis: new Date(2026, 10, 12, 23, 59, 59, 999).getTime(), gid: 'g1', rechnerName, jm: true, plattform: 'win', zustand: 'offen', am,
  });
  u.anfragen = [anfrage('a1', '', JETZT - 3000), anfrage('a2', ' ', JETZT - 2000), anfrage('a3', 'REGIE-01', JETZT - 1000)];
  const M51 = '(kein Name gemeldet)';
  const b27 = /B27: '([^']*)'/.exec(readFileSync(new URL('../../../services/release-proxy/konto-seiten.js', import.meta.url), 'utf8'));
  const zeile = (t: string): string => `Maria Schmidt · Gala · 10.11.2026 bis 12.11.2026 · ${t} (JM-Rechner)`;
  kreuz('Z2 Fixrunde 2 (N1): Geräte und Anfragen zeigen bei leerem Rechnernamen (leer oder nur Leerraum) M51 „(kein Name gemeldet)“, sonst den Namen; die Daten bleiben unverändert; M51 ist B27 ohne „Rechner:“', [
    ['M51 wörtlich', REITER_TEXTE.keinName, M51],
    ['B27 = „Rechner: “ + M51', b27 ? b27[1] : '(B27 fehlt)', `Rechner: ${M51}`],
    ['Geräte', geraeteZeilen(u).map((g) => `${g.gid}|${g.rechner}`).join(' / '), `g1|${M51} / g2|${M51} / g3|REGIE-01`],
    ['Anfragen', anfrageZeilen(u).map((z) => `${z.id}|${z.text}`).join(' / '), `a1|${zeile(M51)} / a2|${zeile(M51)} / a3|${zeile('REGIE-01')}`],
    ['Daten unverändert', JSON.stringify([...u.geraete.map((g) => g.name), ...u.anfragen.map((a) => a.rechnerName)]), JSON.stringify(['', '   ', 'REGIE-01', '', ' ', 'REGIE-01'])],
  ]);
}

// --- P27 9.4: Texte M30–M47 wörtlich, ohne ASCII-Anführungszeichen -----------------------------------------------------------
{
  const T = REITER_TEXTE;
  kreuz('P27 9.4: M30–M47 wörtlich', [
    ['M30', [T.spalteEvent, T.spalteBasis, T.spalteAm, T.spalteVon].join(' / '), 'Event / Basis / hinterlegt am / von'],
    ['M31', [T.feldBasis, T.feldToken, T.eventsLaden, T.hinterlegen].join(' / '), 'Basis-URL / Token / Events laden / Hinterlegen'],
    ['M32', T.tokenHinweis, 'Das Token wird nach dem Hinterlegen nie wieder angezeigt, nur ersetzt oder entfernt.'],
    ['M33', `${T.ersetzen} / ${T.entfernen}`, 'Ersetzen / Entfernen'],
    ['M34', T.frageEntfernen, 'Launcher, die das Token schon haben, behalten es bis zu ihrem nächsten Start.'],
    ['M35', [T.keineEvents, T.eventWaehlen, T.tokenFehlt].join(' / '), 'Noch kein Event hinterlegt. / Wähle mindestens ein Event. / Füge das Token ein.'],
    ['M40', `${T.anfrage('N', 'Z', 'D1', 'D2', 'R', true)} / ${T.anfrage('N', 'Z', 'D1', 'D2', 'R', false)}`, 'N · Z · D1 bis D2 · R (JM-Rechner) / N · Z · D1 bis D2 · R (kein JM-Rechner)'],
    ['M41', T.warnungKeinJm, 'Achtung: kein JM-Rechner. Die Freigabe wirkt dort nicht.'],
    ['M42', [T.freigeben, T.ablehnen, T.keineAnfragen].join(' / '), 'Freigeben bis … / Ablehnen / Keine offenen Anfragen.'],
    ['M43', [T.spalteRechner, T.spalteKonto, T.spalteKontakt, T.spalteVersion, T.spaltePlattform, T.spalteJm].join(' / '), 'Rechner / zuletzt angemeldet / letzter Kontakt / Version / Plattform / JM-Rechner'],
    ['M44', `${T.altKeyBis('D')} / ${T.altKeyOhneEnde}`, 'Alter Schlüssel angenommen bis D. / Alter Schlüssel ohne Enddatum angenommen.'],
    ['M45', [T.alteLauncher, T.alteZeile('D', 'G', 'P', 4, 'Z'), T.keineAlten].join(' / '), 'Alte Launcher (ohne Anmeldung) / D · G · P: 4 Anfragen, zuletzt Z / Keine Anfragen mit dem alten Schlüssel.'],
    ['M46', Object.values(T.gruppe).join(' / '), 'Katalog und Updates / Q&A extern'],
    ['M47', T.connect, 'Für Connect gilt der alte Schlüssel weiter, bis Connect die Anmeldung nutzt.'],
  ]);
  const alle: string[] = [];
  const sammle = (x: unknown): void => {
    if (typeof x === 'string') alle.push(x);
    else if (typeof x === 'function') alle.push(String((x as (...a: unknown[]) => string)('A', 'B', 'C', 'D', 'E', true)));
    else if (x && typeof x === 'object') Object.values(x).forEach(sammle);
  };
  sammle(REITER_TEXTE);
  ck(`P27 G2: keine ASCII-Anführungszeichen in den Texten der Reiter (${alle.length} Zeichenketten)`, alle.length >= 30 && alle.every((t) => !t.includes('"')));
}

// --- Z1-L2 AR75: Antwort der Aktion ohne neue Übersicht lässt die Maske stehen ---------------------------------------------------
{
  const alt = uebersicht([zugang({ kid: 'alt' })]);
  const neu = uebersicht([zugang({ kid: 'neu' })]);
  const vorher = { daten: alt, laedt: true, fehler: null };
  const s = (daten: AdminUebersicht | null, fehler?: KontoFehlerCode): string => {
    const r = adminNachAktion(vorher, daten, fehler);
    return `${r.daten === alt ? 'alt' : r.daten === neu ? 'neu' : String(r.daten)}|${r.laedt}|${r.fehler}`;
  };
  kreuz('Z1-L2 AR75: Übersicht da → neue Daten; Übersicht gescheitert (daten null) → alte Daten bleiben, Fehler der Übersicht steht', [
    ['neue Übersicht', s(neu), 'neu|false|null'],
    ['Übersicht scheitert, netz', s(null, 'netz'), 'alt|false|netz'],
    ['Übersicht scheitert, zu-viele', s(null, 'zu-viele'), 'alt|false|zu-viele'],
    ['Übersicht scheitert ohne Code', s(null), 'alt|false|server'],
    ['neue Übersicht, Fehler wird ignoriert', s(neu, 'netz'), 'neu|false|null'],
  ]);
  ck('Z1-L2 AR75: der Fehler der Übersicht erscheint mit dem bestehenden Fehlertext (M4 mit Grund)',
    ladeFehlerText('netz') === 'Die Admin-Maske konnte nicht geladen werden: Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.');
}

// --- Z1-L2 OE2, M49: iveo-basis-unbekannt in der Admin-Maske ---------------------------------------------------------------------
{
  const M49 = 'Diese iveo-Adresse ist nicht freigegeben. Erlaubt sind Production (app.my-iveo.de) und Staging (staging-dev.my-iveo.de).';
  kreuz('Z1-L2 M49: Text wörtlich, fehlerText für iveo-basis-unbekannt bei jeder Aktion', [
    ['M49 wörtlich', ADMIN_TEXTE.iveoBasisUnbekannt, M49],
    ['beim Hinterlegen', fehlerText('iveo-basis-unbekannt', 'iveo-hinterlegen'), M49],
    ['ohne Aktion', fehlerText('iveo-basis-unbekannt'), M49],
    ['beim Entfernen', fehlerText('iveo-basis-unbekannt', 'iveo-entfernen'), M49],
    ['uhr bleibt der Serverfehler', fehlerText('uhr'), ANMELDE_TEXTE.server],
  ]);
  ck('Z1-L2 G2: keine ASCII-Anführungszeichen in M49', !ADMIN_TEXTE.iveoBasisUnbekannt.includes('"'));
}

// --- Z1-L2 M50: Einladen — E-Mail-Format, ungültiges Datum, Vergangenheit, leere Events ---------------------------------------------
{
  const M50 = 'Bitte eine gültige E-Mail-Adresse eingeben.';
  const e = (form: Partial<Parameters<typeof einladeFormular>[0]>): string => {
    const r = einladeFormular({ email: 'neu@partner.de', name: 'X', tools: [], events: [], bis: '2026-12-31', ...form });
    return 'fehler' in r ? `fehler|${r.fehler}` : r.aktion === 'einladen' ? `einladen|${r.email}|${r.events.join(',')}|${zeit(r.bis)}` : r.aktion;
  };
  const ungueltigeMails = ['abc', 'a@b', 'a b@c.de', '@x.de', 'x@.de', 'a@@b.de', 'a@b.', 'a@b c.de', '', '   ', 'a@b..de'];
  kreuz('Z1-L2 M50: ungültige E-Mail-Adresse → M50 (vor Domain und Datum)', ungueltigeMails.map((m): [string, string, string] => [`"${m}"`, e({ email: m }), `fehler|${M50}`]));
  kreuz('Z1-L2 M50: gültige Adressen gehen durch, Domain bleibt M28, Reihenfolge M50 vor M27', [
    ['gewöhnlich', e({ email: 'a.b+c@sub.partner.de' }), 'einladen|a.b+c@sub.partner.de||31.12.2026 23:59:59.999'],
    ['Domain', e({ email: 'neu@jakobsmedien.com' }), `fehler|${ADMIN_TEXTE.domain}`],
    ['Format vor Datum', e({ email: 'abc', bis: '' }), `fehler|${M50}`],
  ]);
  kreuz('Z1-L2: ungültiges Datum zeigt „ungültige Anfrage“ statt M27; leeres Datum bleibt M27', [
    ['30. Februar', e({ bis: '2026-02-30' }), `fehler|${ADMIN_TEXTE.ungueltig}`],
    ['Unsinn', e({ bis: 'morgen' }), `fehler|${ADMIN_TEXTE.ungueltig}`],
    ['Jahr 0050', e({ bis: '0050-01-01' }), `fehler|${ADMIN_TEXTE.ungueltig}`],
    ['leer', e({ bis: '' }), `fehler|${ADMIN_TEXTE.bisFehlt}`],
    ['nur Leerzeichen', e({ bis: '  ' }), `fehler|${ADMIN_TEXTE.bisFehlt}`],
  ]);
  // [T] Der Client urteilt nicht über die Vergangenheit; der Worker lehnt sie ab (ungueltig) und die Maske zeigt dessen Text.
  kreuz('Z1-L2 [T]: „bis“ in der Vergangenheit und leere Events gehen unverändert an den Worker, dessen Antwort ungueltig wird angezeigt', [
    ['bis gestern', e({ bis: '2026-10-20' }), 'einladen|neu@partner.de||20.10.2026 23:59:59.999'],
    ['leere Events', e({ events: [] }), 'einladen|neu@partner.de||31.12.2026 23:59:59.999'],
    ['Antwort ungueltig', fehlerText('ungueltig', 'einladen'), ADMIN_TEXTE.ungueltig],
  ]);
  ck('Z1-L2 G2: keine ASCII-Anführungszeichen in M50 und M50 wörtlich', ADMIN_TEXTE.emailUngueltig === M50 && !M50.includes('"'));
}

// --- Z1-L2 [T]: alte Launcher mit unbekannter Gruppe zeigen die Kennung statt „undefined“ ------------------------------------------------
{
  const u = uebersicht([]);
  u.altKey.zeilen = [{ tag: '2026-10-21', gruppe: 'neu' as 'qa', plattform: 'win/x64', anzahl: 1, zuletzt: new Date(2026, 9, 21, 9, 0).getTime() }];
  kreuz('Z1-L2 [T]: alteLauncherZeilen — unbekannte Gruppe fällt auf die Kennung zurück', [
    ['unbekannte Gruppe', alteLauncherZeilen(u).join(' / '), '21.10.2026 · neu · win/x64: 1 Anfragen, zuletzt 09:00'],
    ['Wächter gegen „constructor“', alteLauncherZeilen({ ...u, altKey: { ...u.altKey, zeilen: [{ ...u.altKey.zeilen[0], gruppe: 'constructor' as 'qa' }] } }).join(' / '),
      '21.10.2026 · constructor · win/x64: 1 Anfragen, zuletzt 09:00'],
  ]);
}

// --- Z1-L2: nach dem Sperren bleibt das Detail offen ----------------------------------------------------------------------------------
kreuz('Z1-L2: „Zugang löschen“ — Google-Konto wird gesperrt und bleibt sichtbar (Detail offen), ein Externer verschwindet (Detail zu)', [
  ['Google', String(loeschenSchliesstDetail(zugang({ art: 'google', stufe: 'kollege' }))), 'false'],
  ['Passwort', String(loeschenSchliesstDetail(zugang({ art: 'passwort' }))), 'true'],
]);

// --- Z1-L2 Minor 3: „Ersetzen“ stellt die Vorauswahl nach „Events laden“ wieder her -------------------------------------------------
{
  const B = 'https://app.my-iveo.de/api/v1';
  const ev = [{ slug: 'cop31', name: 'COP31' }, { slug: 'amb', name: 'Ambiente' }];
  const v = (events: typeof ev, vor: { basis: string; slug: string } | null, basis: string): string => vorauswahlNachLaden(events, vor, basis).join(',');
  kreuz('Z1-L2: Vorauswahl nur, wenn der Slug in der geladenen Liste steht und die Basis die des Ersetzens ist', [
    ['Slug dabei', v(ev, { basis: B, slug: 'cop31' }, B), 'cop31'],
    ['Slug nicht mehr dabei', v([ev[1]], { basis: B, slug: 'cop31' }, B), ''],
    ['andere Basis geladen (AR63)', v(ev, { basis: B, slug: 'cop31' }, 'https://staging-dev.my-iveo.de/api/v1'), ''],
    ['kein Ersetzen', v(ev, null, B), ''],
    ['leere Liste', v([], { basis: B, slug: 'cop31' }, B), ''],
  ]);
}

// ── Ende der Fälle (Admin-Maske) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
