// Testhilfen der Q&A-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { QaCloudInfo, QaEntry, QaState, ToolLink } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8733, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8733, clients: 0, modus: 'open', ...z };
}

// ── Aufgabe d: feste Q&A-Zustände und Render-Hilfen (aus apps/rundown/test/ui/testzustand.ts; die Views bekommen den Stand als Prop) ──
/** Q&A-Stand ohne Einträge, ohne Extern und ohne Gegenstellen; `teil` überschreibt einzelne Felder. */
export function qaState(teil: Partial<QaState> = {}): QaState {
  return {
    entries: [],
    activeId: null,
    config: {
      speakSeconds: 120,
      autoTimer: true,
      autoTitler: true,
      moderation: false,
      remoteEnabled: false,
      titlerTemplate: 'lowerthird',
      cloudEnabled: false,
      proxyUrl: '',
      eventId: '',
      pressCode: '',
      streamOpen: true,
      pressOpen: true,
    },
    remote: { running: false, urls: [] },
    cloud: cloud(),
    links: [],
    overrides: {},
    ...teil,
  };
}

/** Extern-Info: ausgeschaltet, nicht eingerichtet, ohne Zugang. */
export function cloud(teil: Partial<QaCloudInfo> = {}): QaCloudInfo {
  return {
    enabled: false,
    configured: false,
    eventId: '',
    proxyUrl: 'https://relay.example',
    streamUrl: '',
    pressUrl: '',
    pressCode: '',
    streamOpen: true,
    pressOpen: true,
    hasKey: false,
    zugang: { art: 'keiner', zeile: '', ton: 'ok', hinweis: null },
    lastError: null,
    lastPollAt: null,
    ...teil,
  };
}

export function eintragQ(id: string, status: QaEntry['status'], teil: Partial<QaEntry> = {}): QaEntry {
  return { id, name: id, affiliation: '', question: '', status, source: 'operator', channel: 'operator', approved: true, at: 1, ...teil };
}

export function toolLink(teil: Partial<ToolLink> = {}): ToolLink {
  return { role: 'timer', label: 'JM Timer', host: '10.0.0.7', port: 8730, connected: true, source: 'mdns', state: null, ...teil };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function entities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button'). */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Text ohne Tags (Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste in Reihenfolge: [id, Zustand, Tooltip „Label: Detail“]. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [
    attr(m[0], 'data-status-id'),
    attr(m[0], 'data-state'),
    attr(m[0], 'title'),
  ]);
}

/** Das Element mit diesem data-qa-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-qa="${marke}"[^>]*>`).exec(html);
  if (!m) return '';
  const name = m[1];
  const re = new RegExp(`<${name}(?=[\\s>/])[^>]*>|</${name}>`, 'g');
  re.lastIndex = m.index;
  let tiefe = 0;
  for (let t = re.exec(html); t; t = re.exec(html)) {
    tiefe += t[0].startsWith('</') ? -1 : 1;
    if (tiefe === 0) return html.slice(m.index, t.index + t[0].length);
  }
  return html.slice(m.index);
}

/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
export function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}

/** Alle React-Elemente eines (nicht gerenderten) Baums, die `passt` erfüllen: Props und Typ. Läuft durch `props.children`. */
export function elemente(baum: unknown, passt: (e: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  const treffer: Array<{ type: unknown; props: Record<string, unknown> }> = [];
  const lauf = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(lauf);
    else if (n && typeof n === 'object' && 'props' in n) {
      const e = n as { type: unknown; props: Record<string, unknown> };
      if (passt(e)) treffer.push(e);
      lauf(e.props.children);
    }
  };
  lauf(baum);
  return treffer;
}
