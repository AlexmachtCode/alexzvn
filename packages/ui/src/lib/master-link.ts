// Statuseintrag „Master“ aus der lesenden Master-Link-Brücke (Suite-UX-Update, Spec 3.3, 3.9, 7.1–7.4; Plan E3, E4).
// MasterLinkMeldung ist ein struktureller Typ: Er passt zu MasterLinkMeldung aus @jm/app-runtime (ClientZustand oder
// „ohne-client“), ohne app-runtime (Electron-Typen) einzulesen. Zusatzfelder des Clients (adresse, seit, suite, errCode)
// erscheinen nicht: Die Adresse wechselt beim Verbinden je Kandidat, die Statusleiste soll nicht flackern.
// Unbekannt (keine Brücke, noch keine Antwort, unbekannte Art) ist off mit „unbekannt“, nie ok (Spec 7.2); live nie (7.4).
// „ohne-client“ ist warn: Der Tool-Rechner sollte einen Client haben, hat aber keinen gestartet (E4).
import { unbekannt, type StatusItem } from './status';
import { MASTER_LINK_TEXTE } from './texte';

export type MasterLinkMeldung =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet' }
  | { art: 'verbunden'; masterName: string }
  | { art: 'fehler'; code: string; text: string }
  | { art: 'ohne-client' };

const KOPF = { id: 'master-link', group: 'verbindung', label: MASTER_LINK_TEXTE.label } as const;

/** Statuseintrag „Master“: Gruppe verbindung, ohne Einstellungs-Abschnitt (im Panel gibt es keinen). */
export function masterLinkStatusItem(m: MasterLinkMeldung | null | undefined): StatusItem {
  if (m === null || m === undefined) return unbekannt(KOPF);
  switch (m.art) {
    case 'ohne-client':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.ohneClient };
    case 'aus':
      return { ...KOPF, state: 'off', detail: MASTER_LINK_TEXTE.aus };
    case 'sucht':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.sucht };
    case 'verbindet':
      return { ...KOPF, state: 'warn', detail: MASTER_LINK_TEXTE.verbindet };
    case 'verbunden': {
      const name = typeof m.masterName === 'string' ? m.masterName.trim() : '';
      return { ...KOPF, state: 'ok', detail: name === '' ? MASTER_LINK_TEXTE.verbunden : MASTER_LINK_TEXTE.verbundenMit(name) };
    }
    case 'fehler': {
      // Fertiger Text des Clients, Stufe error für jeden Code, auch nicht-gefunden (E4); ohne Text der Code.
      const text = typeof m.text === 'string' ? m.text.trim() : '';
      return { ...KOPF, state: 'error', detail: text !== '' ? text : m.code };
    }
    default:
      return unbekannt(KOPF);
  }
}
