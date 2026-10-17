// UX-Pilot C5 · Statuseintrag „Master“ (Spec 3.3, 3.9, 7.1–7.4): Kreuz über 12 Eingänge nach E4, nie live, ok nur bei
// verbunden, kein Flackern bei wechselnder Adresse, unbekannte Art = unbekannt, Texte nur aus MASTER_LINK_TEXTE (E3, E4, T1).
import * as ui from '../src/index';
import { masterLinkStatusItem, type MasterLinkMeldung } from '../src/lib/master-link';
import { MASTER_LINK_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok } from './harness';

type Eingang = MasterLinkMeldung | null | undefined;

// Titler-Form der Meldung (ClientZustand aus @jm/master-link): Die Adresse wechselt je Kandidat und darf nicht erscheinen.
const VERBINDET_A1 = { art: 'verbindet' as const, adresse: '10.0.0.5:8740' };
const VERBINDET_A2 = { art: 'verbindet' as const, adresse: '10.0.0.7:8740' };
const UNBEKANNTE_ART = { art: 'neu' } as unknown as MasterLinkMeldung;

// Tabelle nach E4: Eingang → {state, detail}.
const FAELLE: ReadonlyArray<[string, Eingang, string, string]> = [
  ['undefined (noch keine Antwort)', undefined, 'off', 'unbekannt'],
  ['null (keine Brücke)', null, 'off', 'unbekannt'],
  ['ohne-client', { art: 'ohne-client' }, 'warn', 'nicht gestartet'],
  ['aus', { art: 'aus' }, 'off', 'aus'],
  ['sucht', { art: 'sucht' }, 'warn', 'sucht …'],
  ['verbindet (Adresse 1)', VERBINDET_A1, 'warn', 'verbindet …'],
  ['verbindet (Adresse 2)', VERBINDET_A2, 'warn', 'verbindet …'],
  ['verbunden mit Namen', { art: 'verbunden', masterName: 'Regie-PC' }, 'ok', 'verbunden mit Regie-PC'],
  ['verbunden ohne Namen', { art: 'verbunden', masterName: '' }, 'ok', 'verbunden'],
  ['fehler nicht-gefunden', { art: 'fehler', code: 'nicht-gefunden', text: 'Master nicht gefunden' }, 'error', 'Master nicht gefunden'],
  ['fehler datei', { art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' }, 'error', 'Kopplungsdatei beschädigt. Neu koppeln.'],
  ['unbekannte Art (neuere app-runtime)', UNBEKANNTE_ART, 'off', 'unbekannt'],
];

for (const [name, eingang, state, detail] of FAELLE) {
  const item = masterLinkStatusItem(eingang);
  gleich({ state: item.state, detail: item.detail }, { state, detail }, `Master: ${name} → ${state} „${detail}“`);
}

{
  const items = FAELLE.map(([, eingang]) => masterLinkStatusItem(eingang));
  ok(
    items.every((i) => i.id === 'master-link' && i.group === 'verbindung' && i.label === 'Master' && !('settingsSection' in i)),
    'Master: Kopf fest (id master-link, Gruppe verbindung, Label Master), kein Einstellungs-Abschnitt',
  );
  ok(
    items.every((i) => i.state !== 'live') && items.every((i, n) => (i.state === 'ok') === (FAELLE[n][1]?.art === 'verbunden')),
    'Master: nie live, ok genau bei verbunden (Spec 7.2, 7.4)',
  );
}

{
  gleich(masterLinkStatusItem(VERBINDET_A1), masterLinkStatusItem(VERBINDET_A2), 'Master: verbindet mit anderer Adresse ergibt dasselbe Item (kein Flackern)');
  const voll = { art: 'verbunden' as const, adresse: '10.0.0.5:8740', seit: 1000, masterName: 'Regie-PC', suite: 'JM Production Suite' };
  gleich(masterLinkStatusItem(voll), masterLinkStatusItem({ art: 'verbunden', masterName: 'Regie-PC' }), 'Master: Zusatzfelder des Clients (Adresse, seit, suite) erscheinen nicht');
  const mitCode = { art: 'fehler' as const, code: 'verweigert', text: 'Master hat die Verbindung abgelehnt', errCode: 'ECONNREFUSED' };
  gleich(masterLinkStatusItem(mitCode).detail, 'Master hat die Verbindung abgelehnt', 'Master: fehler zeigt den Client-Text, nicht errCode');
  gleich(masterLinkStatusItem({ art: 'fehler', code: 'zeit', text: '' }).detail, 'zeit', 'Master: fehler ohne Text zeigt den Code');
}

{
  gleich(
    [MASTER_LINK_TEXTE.label, MASTER_LINK_TEXTE.aus, MASTER_LINK_TEXTE.ohneClient, MASTER_LINK_TEXTE.sucht, MASTER_LINK_TEXTE.verbindet, MASTER_LINK_TEXTE.verbunden, MASTER_LINK_TEXTE.verbundenMit('Regie-PC')],
    ['Master', 'aus', 'nicht gestartet', 'sucht …', 'verbindet …', 'verbunden', 'verbunden mit Regie-PC'],
    'Master: Texte wörtlich (T1, T2)',
  );
  const texte: string[] = Object.values(MASTER_LINK_TEXTE).map((t) => (typeof t === 'function' ? t('x') : t));
  ok(texte.every((t) => !t.includes('"')), 'Master: keine ASCII-Anführungszeichen in den Texten (G5)');
  const quelle = leseText('src/lib/master-link.ts');
  ok(!/detail:\s*['"`]/.test(quelle), 'Master: kein Text-Literal hinter detail: in master-link.ts (Texte nur aus MASTER_LINK_TEXTE)');
}

{
  ok(
    typeof ui.masterLinkStatusItem === 'function' && ui.MASTER_LINK_TEXTE.label === 'Master',
    'Master: Exporte aus src/index.ts (masterLinkStatusItem, MASTER_LINK_TEXTE)',
  );
}
