// mDNS-Übernahme gefundener Hosts als reines Modul (Altfehler Stufe 2, SD-3; ohne electron und ohne @jm/discovery, damit testbar).
// Findet die Suche eine Quelle im LAN, übernimmt Stage Display Host und Port nur, solange die Quelle eingeschaltet, nicht verbunden
// und noch auf der Vorgabe VORGABE_HOST ist. Ein eingetragener (von Hand, per Show oder früher gefundener) Host bleibt stehen, auch
// wenn er gerade nicht erreichbar ist; die Statusleiste sagt dann „nicht erreichbar“. Andere gefundene Hosts werden nicht als
// Vorschläge angezeigt (C5). Die PIN bleibt manuell: die Suche liefert nur die Adresse, nicht das Geheimnis.
import type { PartialStageConfig, StageConfig } from './types';

/** Vorgabe-Host der drei Quellen (DEFAULT_CONFIG in shared/konfig-regeln.ts); nur hier darf die mDNS-Suche umstellen. */
export const VORGABE_HOST = '127.0.0.1';

/** Ein gefundener Dienst, wie @jm/discovery ihn meldet (nur die Felder, die hier zählen). */
export interface MdnsDienst {
  role: string;
  host: string;
  port: number;
  /** Steuer-Endpunkt (TXT ctl=1, TCP-Zeilenprotokoll fürs Companion-Modul). */
  ctl?: boolean;
}

type Quelle = 'timer' | 'switcher' | 'presenter';
const QUELLEN: readonly Quelle[] = ['timer', 'switcher', 'presenter'];

/**
 * Welcher Dienst gilt für die Quelle: Timer und Presenter annoncieren seit dem Companion-Modul (Welle 1.6.2) zwei _jmps._tcp-Dienste,
 * ihren eigenen (Socket.IO bzw. SSE, den Stage Display spricht) und einen Steuer-Endpunkt mit ctl=1; hier gilt der ohne Marke (!ctl),
 * sonst verbände sich der Client mit dem falschen Port. Der Switcher hat keine Marke: sein einziger Dienst ist der TCP-Steuerserver,
 * mit dem sich Stage Display verbindet, also dort bewusst nicht auf !ctl filtern.
 */
function dienstFuer(q: Quelle, dienste: readonly MdnsDienst[]): MdnsDienst | undefined {
  return dienste.find((s) => s.role === q && (q === 'switcher' || !s.ctl));
}

/**
 * Patch der Konfiguration aus einem mDNS-Fund: je Quelle Host und Port des Dienstes, wenn die Quelle an ist, nicht verbunden, auf
 * der Vorgabe steht und der Fund einen anderen Host meldet (wie bisher); sonst nichts. Leer = nichts zu ändern.
 */
export function mdnsUebernahme(
  cfg: StageConfig,
  verbunden: { timer: boolean; switcher: boolean; presenter: boolean },
  dienste: readonly MdnsDienst[],
): PartialStageConfig {
  const patch: PartialStageConfig = {};
  for (const q of QUELLEN) {
    const d = dienstFuer(q, dienste);
    const quelle = cfg[q];
    if (d && quelle.enabled && !verbunden[q] && quelle.host === VORGABE_HOST && d.host !== quelle.host) patch[q] = { host: d.host, port: d.port };
  }
  return patch;
}
