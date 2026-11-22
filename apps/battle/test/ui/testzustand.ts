// Testhilfen der Battle-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d; Aufgabe b liefert den Zustand der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { BattleState, ClipJob, ToolLink } from '@shared/types';

/** Meldung eines laufenden Steuerservers ohne Clients (Port 8734, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8734, clients: 0, modus: 'open', ...z };
}

// ── Aufgabe d: feste Battle-Zustände und Render-Hilfen (aus apps/qa/test/ui/testzustand.ts; die Views bekommen den Stand als Prop) ──
/** Battle-Stand mit drei Runden, Server aus und ohne Gegenstelle; `teil` überschreibt einzelne Felder. */
export function battleState(teil: Partial<BattleState> = {}): BattleState {
  return {
    config: { rounds: 3, votingEnabled: true, autoTitler: true, clipSeconds: 20, recordingPath: '', clipDir: '' },
    competitors: { A: { name: 'Alpha', crew: '' }, B: { name: 'Bravo', crew: '' } },
    round: 2,
    rounds: [1, 2, 3].map((round) => ({ round, juryWinner: null, votesA: 0, votesB: 0 })),
    votingOpen: false,
    live: false,
    remote: { running: false, urls: [] },
    links: [],
    overrides: {},
    clips: [],
    ...teil,
  };
}

/** Wie battleState, aber `config` wird feldweise überschrieben. */
export const mitConfig = (teil: Partial<BattleState['config']>, rest: Partial<BattleState> = {}): BattleState =>
  battleState({ ...rest, config: { ...battleState().config, ...teil } });

export function toolLink(teil: Partial<ToolLink> = {}): ToolLink {
  return { role: 'titler', label: 'JM Titler', host: '10.0.0.7', port: 8735, connected: true, source: 'mdns', state: null, ...teil };
}

export function clipJob(status: ClipJob['status'], teil: Partial<ClipJob> = {}): ClipJob {
  return { id: status, status, outputPath: 'C:/Clips/x.mp4', seconds: 20, at: 1, ...teil };
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

/** Das Element mit diesem data-ba-Wert samt Inhalt (Ende am passenden schließenden Tag gleichen Namens). */
export function bereich(html: string, marke: string): string {
  const m = new RegExp(`<(\\w+)\\s[^>]*data-ba="${marke}"[^>]*>`).exec(html);
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
