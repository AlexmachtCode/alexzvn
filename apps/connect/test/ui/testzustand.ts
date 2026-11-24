// Testhilfen der Connect-Oberflächentests (UX Welle 2b, Task 21, 22, 23): feste Zustände, Attrappen und Hilfen für Render- und
// Quelltext-Prüfungen. Die Bausteine des Stands (appStatus, ansicht, stand, gast, raum) teilen sich oberflaeche.test.ts und die
// Rahmen-, Live- und Panel-Tests; die Markup-Hilfen lesen gerendertes HTML ohne Browser (wie apps/presenter/test/ui/testzustand.ts).
import type { Guest, GuestPhase, OperatorAction, RoomState } from '@jm/rtc/protocol';
import { baueAppStatus, type AppStatusEingabe } from '@shared/app-status';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { raumAnsicht, type RaumAnsichtEingabe } from '@shared/raum-ansicht';
import type { AppStatus, GuestInvite, NdiProgrammLage, ProxyInfo, ShowInfo } from '@shared/types';
import type { OberflaechenStand } from '@/lib/oberflaeche';
import type { ConnectAktionen } from '@/views/ConnectOberflaeche';

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Fernsteuerungs-Meldung des Steuerservers (Port 8737) mit Vorgaben; Felder ohne Wert fehlen (nie undefined). */
export function basisMeldung(patch: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8737, clients: 0, ...patch };
}

// ── Bausteine des Stands ──

export const LAGE: NdiProgrammLage = { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: 'JM Switcher', bereit: false };

export function appStatus(teil: Partial<AppStatusEingabe> = {}): AppStatus {
  return baueAppStatus({
    configured: true,
    proxyBase: 'https://cloud.example',
    proxyKeySource: 'none',
    controlPort: 8737,
    ndiGaeste: [],
    ndiProgramm: LAGE,
    presenterLinked: false,
    zoom: null,
    cloudZugang: { text: 'Angemeldet über den Launcher', ton: 'ok' },
    ...teil,
  });
}

export function ansicht(teil: Partial<RaumAnsichtEingabe> = {}): OberflaechenStand['ansicht'] {
  return raumAnsicht({ client: false, verbunden: false, raumBekannt: false, raumabbruch: false, ...teil });
}

/** Stand vor jeder Antwort (alles undefined), Windows; `teil` überschreibt einzelne Eingänge. */
export function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    status: undefined,
    room: undefined,
    connected: false,
    ansicht: ansicht(),
    zoom: undefined,
    plattform: 'win32',
    masterLink: undefined,
    fernsteuerung: undefined,
    ...teil,
  };
}

export function gast(id: string, phase: GuestPhase, teil: Partial<Guest> = {}): Guest {
  return { id, name: `Gast ${id}`, phase, tally: 'off', consentAt: null, muted: false, hasVideo: true, hasScreen: false, canAdvance: false, joinedAt: 0, ...teil };
}

export function raum(phasen: GuestPhase[] = [], talkback: RoomState['talkback'] = { mode: 'off', target: null }): RoomState {
  return { room: 'raum-1', guests: phasen.map((p, i) => gast(`g${i + 1}`, p)), standbyId: null, talkback };
}

/** Offener, verbundener Raum mit den gegebenen Gästen (Client besteht, Raumverbindung, Raum-Zustand bekannt). */
export function offenerRaum(r: RoomState, teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return stand({ status: appStatus(), room: r, connected: true, ansicht: ansicht({ client: true, verbunden: true, raumBekannt: true }), ...teil });
}

export const SHOW: ShowInfo = {
  name: 'Abschlussplenum',
  room: 'abschlussplenum',
  eventName: 'Fachkonferenz · Abschlussplenum',
  speakers: [
    { name: 'Anna Berger', title: 'Moderatorin' },
    { name: 'Jonas Keller', title: null },
  ],
};

export const EINLADUNG: GuestInvite = { guestId: 'inv1', name: 'Anna Berger', joinUrl: 'https://cloud.example/connect/raum-1?t=abc' };

/**
 * Aktionen der Wurzel-View als Attrappe: jeder Aufruf schreibt eine Zeile ins Protokoll (Name und Argument), nichts geht an IPC
 * oder an den Raum. proxySpeichern antwortet mit der gespeicherten Adresse.
 */
export function aktionenAttrappe(log: string[] = []): ConnectAktionen {
  const info = (url: string): ProxyInfo => ({ url, keySource: 'none', configured: url !== '', zugang: { text: '', ton: 'ok' } });
  return {
    raumOeffnen: () => void log.push('raumOeffnen'),
    raumSchliessen: () => void log.push('raumSchliessen'),
    talkbackDown: (target) => void log.push(`talkbackDown:${target ?? 'alle'}`),
    talkbackUp: () => void log.push('talkbackUp'),
    folien: (g) => void log.push(`folien:${g.id}`),
    send: (a: OperatorAction) => void log.push(`send:${JSON.stringify(a)}`),
    gastName: (n) => void log.push(`gastName:${n}`),
    gastEinladen: () => void log.push('gastEinladen'),
    sprecherEinladen: () => void log.push('sprecherEinladen'),
    proxySpeichern: (url) => {
      log.push(`proxySpeichern:${url}`);
      return Promise.resolve(info(url));
    },
    keyEntfernen: () => {
      log.push('keyEntfernen');
      return Promise.resolve(info('https://cloud.example'));
    },
  };
}

// ── Markup-Hilfen (gerendertes HTML, ohne Browser) ──

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Namens im HTML. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst). */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Sichtbarer Text des HTML (ohne Tags, Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste als [id, Zustand, Titel] in der gerenderten Reihenfolge. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [attr(m[0], 'data-status-id'), attr(m[0], 'data-state'), attr(m[0], 'title')]);
}

/** HTML eines Panel-Abschnitts: vom Anker `einstellung-<id>` bis zum nächsten Anker. */
export function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}

/** Inhalt eines Bereichs `data-<schluessel>="<wert>"` bis zu seinem schließenden Tag (Tiefe gezählt, gleiches Tag). */
export function bereich(html: string, schluessel: string, wert: string): string {
  const start = html.search(new RegExp(`<(\\w+)[^>]*\\s${schluessel}="${wert}"`));
  if (start < 0) return '';
  const name = /^<(\w+)/.exec(html.slice(start))?.[1] ?? 'div';
  const muster = new RegExp(`<${name}(?=[\\s>])|</${name}>`, 'g');
  muster.lastIndex = start;
  let tiefe = 0;
  for (let m = muster.exec(html); m !== null; m = muster.exec(html)) {
    tiefe += m[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

/** Alle Bereiche `data-<schluessel>="<wert>"` in Reihenfolge (z. B. jede Gastzeile). */
export function bereiche(html: string, schluessel: string, wert: string): string[] {
  const aus: string[] = [];
  let rest = html;
  for (let b = bereich(rest, schluessel, wert); b !== ''; b = bereich(rest, schluessel, wert)) {
    aus.push(b);
    rest = rest.slice(rest.indexOf(b) + b.length);
  }
  return aus;
}

/** Beschriftungen der Knöpfe (sichtbarer Text) in Reihenfolge. */
export function knopfTexte(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
}

/** Die TallyButtons (data-state) als Tag, Text und Zustand. */
export function tallyTasten(html: string): Array<{ tag: string; text: string; state: string | undefined }> {
  return [...html.matchAll(/(<button[^>]*\sdata-state="[^"]*"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({ tag: m[1], text: text(m[2]).trim(), state: attr(m[1], 'data-state') }));
}

/** Halte-Knöpfe (HalteKnopf aus @jm/ui: button mit aria-pressed) als Tag und Beschriftung. */
export function halteKnoepfe(html: string): Array<{ tag: string; label: string }> {
  return [...html.matchAll(/(<button[^>]*\saria-pressed="(?:true|false)"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({ tag: m[1], label: text(m[2]).trim() }));
}
