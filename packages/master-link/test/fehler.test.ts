import { abschnitt, gleich, pruefe } from './helfer';
import { fristen } from '../src/fristen';
import { fehlerText, ordneEin, PIN_FALSCH, RAHMEN, rueckzugMs, staerkster, wiederholung } from '../src/fehler';

export async function laufe(): Promise<void> {
  abschnitt('Fehler: Einordnung (Spec 6.1, 9.1)');
  gleich(ordneEin({ art: 'tcp-timeout' }, true), { art: 'code', code: 'zeit' }, 'TCP-Timeout + mDNS gesehen → zeit (Firewall?)');
  gleich(ordneEin({ art: 'tcp-timeout' }, false), { art: 'code', code: 'nicht-gefunden' }, 'TCP-Timeout ohne mDNS → nicht-gefunden (Windows-Stealth)');
  const tabelle: Array<[string, string]> = [
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'zertifikat'], ['SELF_SIGNED_CERT_IN_CHAIN', 'zertifikat'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'zertifikat'], ['CERT_SIGNATURE_FAILURE', 'zertifikat'], [PIN_FALSCH, 'zertifikat'],
    ['CERT_NOT_YET_VALID', 'uhr'], ['CERT_HAS_EXPIRED', 'uhr'],
    ['ECONNREFUSED', 'verweigert'], ['EHOSTUNREACH', 'netz'], ['ENETUNREACH', 'netz'],
    ['ERR_SSL_WRONG_VERSION_NUMBER', 'kein-master'], [RAHMEN, 'kein-master'],
    ['ECONNRESET', 'sonstig'], ['EPIPE', 'sonstig'],
  ];
  for (const [errCode, code] of tabelle) {
    gleich(ordneEin({ art: 'fehler', code: errCode }, false), { art: 'code', code }, `${errCode} → ${code}`);
  }
  gleich(ordneEin({ art: 'fehler', code: 'ETIMEDOUT' }, true), { art: 'code', code: 'zeit' }, 'ETIMEDOUT + mDNS → zeit');
  gleich(ordneEin({ art: 'frist' }, true), { art: 'code', code: 'kein-master' }, 'Frist nach TCP → kein-master');
  for (const grund of ['unbekannt', 'signatur', 'protokoll', 'ersetzt'] as const) {
    gleich(ordneEin({ art: 'abgelehnt', grund }, true), { art: 'code', code: grund }, `abgelehnt ${grund} → Code ${grund}`);
  }
  gleich(ordneEin({ art: 'abgelehnt', grund: 'anmeldefrist' }, true), { art: 'intern', grund: 'anmeldefrist' }, 'anmeldefrist ist intern (kein „Firewall“-Text)');
  gleich(ordneEin({ art: 'abgelehnt', grund: 'last' }, true), { art: 'intern', grund: 'last' }, 'last ist intern');

  abschnitt('Fehler: Rangfolge');
  gleich(staerkster(['nicht-gefunden', 'zeit', 'verweigert']), 'verweigert', 'verweigert vor zeit vor nicht-gefunden');
  gleich(staerkster(['netz', 'sonstig']), 'sonstig', 'sonstig vor netz');
  gleich(staerkster(['zeit', 'unbekannt', 'zertifikat']), 'unbekannt', 'unbekannt schlägt alles');
  gleich(staerkster([]), null, 'nichts → null');

  abschnitt('Fehler: Wiederholung');
  const f = fristen();
  gleich(wiederholung('zertifikat', f), { art: 'fest', ms: 30_000 }, 'zertifikat alle 30 s');
  gleich(wiederholung('uhr', f), { art: 'fest', ms: 30_000 }, 'uhr alle 30 s');
  gleich(wiederholung('protokoll', f), { art: 'fest', ms: 60_000 }, 'protokoll alle 60 s');
  gleich(wiederholung('ersetzt', f), { art: 'fest', ms: 60_000 }, 'ersetzt alle 60 s');
  gleich(wiederholung('last', f), { art: 'fest', ms: 5000 }, 'last frühestens nach 5 s');
  for (const c of ['unbekannt', 'signatur', 'datei'] as const) gleich(wiederholung(c, f), { art: 'keine' }, `${c}: keine Wiederholung bis Dateiänderung`);
  for (const c of ['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'sonstig', 'anmeldefrist'] as const) {
    gleich(wiederholung(c, f), { art: 'rueckzug' }, `${c}: normaler Rückzug`);
  }
  gleich(rueckzugMs(0, f, () => 0.5), 1000, 'Rückzug 1 s');
  gleich(rueckzugMs(3, f, () => 0.5), 8000, 'Rückzug 8 s');
  gleich(rueckzugMs(9, f, () => 0.5), 10_000, 'Rückzug gedeckelt bei 10 s');
  gleich(rueckzugMs(0, f, () => 0), 750, '−25 %');
  gleich(rueckzugMs(0, f, () => 1), 1250, '+25 %');

  abschnitt('Fehler: Texte (Spec 9.1 wörtlich)');
  gleich(fehlerText('zeit', { masterName: 'Regie-PC' }),
    'Regie-PC ist im Netz sichtbar, aber Port 8738 antwortet nicht. Wahrscheinlich sperrt die Firewall am Master (Regel und Netzprofil prüfen).', 'zeit');
  gleich(fehlerText('nicht-gefunden', { masterName: 'Regie-PC' }),
    'Regie-PC nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus, anderes Netz oder Firewall. Gleiches Netz? Sonst feste Adresse eintragen.', 'nicht-gefunden');
  gleich(fehlerText('kein-master', { masterName: 'X', adresse: '10.0.0.9' }), 'Unter 10.0.0.9 antwortet ein Dienst, aber nicht als Master.', 'kein-master nennt die Adresse');
  pruefe(fehlerText('protokoll', { masterName: 'X', suite: '0.13.0', masterProtokoll: 2 }).includes('Launcher 0.13.0 (Protokoll 2)'), 'protokoll nennt Stand des Masters');
  gleich(fehlerText('sonstig', { masterName: 'X', errCode: 'ECONNRESET' }), 'Verbindungsfehler ECONNRESET.', 'sonstig nennt err.code');
  // Endprüfung D1 (Ruling Klon): „Neu koppeln“ allein sperrte das Original aus — der Weg ist „Neue Kennung“ am Klon.
  gleich(fehlerText('ersetzt', { masterName: 'X' }),
    'Diese Rechnerkennung meldet sich ein zweites Mal beim Master an (Ordner kopiert oder Rechner geklont?). Auf dem kopierten Rechner „Neue Kennung“ wählen, dann neu koppeln.',
    'ersetzt verweist auf „Neue Kennung“ am kopierten Rechner (Spec 9.1, Nachtrag)');
}
