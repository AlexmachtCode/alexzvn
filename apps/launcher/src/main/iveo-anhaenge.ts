// Anhänge der Side Events (iveo-Paket Teil D, Spec 8.2–8.5): Abbildung, Löschregel, Laufzeitprüfung, Materialsignatur mit
// Referenz-Hash und Anhang-Wächter. Ohne Electron, per tsx getestet (test/iveo-anhaenge.test.ts); iveo-sync.ts verdrahtet.
//
// SICHERHEIT (E20): `asset.url` ist eine signierte Referenz. Sie steht in keiner Signatur, keinem Ereignis und keinem Log;
// die Signaturen tragen nur ihren SHA-256 (referenzHash, Messung M1 vom 17.10.2026).
import { createHash } from 'node:crypto';
import type { IveoAgendaItem, IveoClient, IveoMaterial } from '@jm/iveo';
import type { IveoMaterialRef } from '@shared/types';
import { toClientError } from './iveo-abgleich-kern';

/**
 * Agenda eines Side Events: aus der Abfrage des Kerns (meldeAgenda, 8.2) oder aus einem eigenen Abruf. `abgerufen` = Zeitpunkt
 * vor dem Abruf; ein Fehlschlag trägt ihn, wenn er bekannt ist (der Anhang-Wächter ordnet ihn damit der Anmeldung zu, EP20).
 */
export type AgendaErgebnis = { ok: true; agenda: IveoAgendaItem[]; abgerufen: string } | { ok: false; fehler: unknown; abgerufen?: string };

/** Anhang nach der Laufzeitprüfung (8.5). `groesse` = `size_bytes`, wenn es eine endliche Zahl ≥ 0 ist, sonst null. */
export interface GueltigerAnhang {
  item: IveoAgendaItem;
  m: IveoMaterial;
  groesse: number | null;
}

/** Anhang mit leerer Kennung oder unbekanntem `kind`: nicht in der Liste, im Ordner Problem T22 (i). */
export interface UngueltigerAnhang {
  item: IveoAgendaItem;
  id: string | null;
  feld: 'id' | 'kind';
}

/**
 * Gelöscht (8.5, E22, **Annahme**): jeder Wert von `purged_at` außer `null`, fehlend, `false` und Leerstring, also auch
 * eine Zahl, `true` oder ein Datum. Auf Prod war das Feld da, aber nie gesetzt; der Typ eines gesetzten Werts ist unbekannt.
 */
export function istGeloescht(m: { purged_at?: unknown }): boolean {
  const v = m.purged_at;
  return !(v === undefined || v === null || v === false || v === '');
}

/**
 * Laufzeitprüfung der Anhang-Felder (8.5) in iveo-Reihenfolge: gelöschte fallen weg; gültig ist ein Anhang mit nicht
 * leerer `id` und `kind` `file` oder `link`. Dieselbe Kennung an zwei Agenda-Punkten: Es gilt das erste Vorkommen, die
 * weiteren entfallen ohne Fehler.
 */
export function pruefeAnhaenge(agenda: IveoAgendaItem[]): { gueltig: GueltigerAnhang[]; ungueltig: UngueltigerAnhang[] } {
  const gueltig: GueltigerAnhang[] = [];
  const ungueltig: UngueltigerAnhang[] = [];
  const gesehen = new Set<string>();
  for (const item of agenda) {
    const liste: unknown = (item as { materials?: unknown } | null)?.materials;
    if (!Array.isArray(liste)) continue;
    for (const roh of liste as unknown[]) {
      if (roh === null || typeof roh !== 'object') {
        ungueltig.push({ item, id: null, feld: 'id' });
        continue;
      }
      const m = roh as IveoMaterial;
      if (istGeloescht(m)) continue;
      const id = typeof m.id === 'string' && m.id !== '' ? m.id : null;
      if (id === null) {
        ungueltig.push({ item, id: null, feld: 'id' });
        continue;
      }
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      if (m.kind !== 'file' && m.kind !== 'link') {
        ungueltig.push({ item, id, feld: 'kind' });
        continue;
      }
      const s: unknown = m.asset?.size_bytes;
      gueltig.push({ item, m, groesse: typeof s === 'number' && Number.isFinite(s) && s >= 0 ? s : null });
    }
  }
  return { gueltig, ungueltig };
}

/** SHA-256 (hex) der Asset-Referenz `asset.url`, wenn sie ein nicht leerer String ist, sonst null (8.3, M1). */
export function referenzHash(m: IveoMaterial): string | null {
  const u: unknown = m.asset?.url;
  return typeof u === 'string' && u !== '' ? createHash('sha256').update(u, 'utf8').digest('hex') : null;
}

/**
 * Anhang-Liste eines Side Events für Panel und Ereignis (8.2; die Abbildung aus `iveo-sync.ts:639-653`, die dort Task 28
 * umstellt): flach über alle Agenda-Punkte, ohne gelöschte und ungültige, Label-Rückfall „(ohne Titel)“.
 */
export function materialienAusAgenda(agenda: IveoAgendaItem[]): IveoMaterialRef[] {
  return pruefeAnhaenge(agenda).gueltig.map(({ item, m, groesse }) => ({
    id: m.id,
    label: typeof m.label === 'string' && m.label !== '' ? m.label : '(ohne Titel)',
    kind: m.kind,
    agendaTitle: item.title,
    mimeType: m.asset?.mime_type ?? null,
    sizeBytes: groesse,
    externalUrl: m.external_url ?? null,
    hasAsset: referenzHash(m) !== null,
  }));
}

/**
 * Materialsignatur eines Side Events (8.3): JSON aus der Agenda ohne gelöschte Anhänge, iveo-Reihenfolge. Je Anhang
 * `[item.id, m.id, m.kind, m.label, m.sort_order ?? null, m.asset?.mime_type ?? null, m.asset?.size_bytes ?? null,
 * m.external_url ?? null, refHash]`; die Referenz selbst steht nie darin (E20). Eine neue Reihenfolge zählt als Änderung.
 */
export function materialSignatur(agenda: IveoAgendaItem[]): string {
  return JSON.stringify(
    pruefeAnhaenge(agenda).gueltig.map(({ item, m }) => [
      item.id,
      m.id,
      m.kind,
      m.label,
      m.sort_order ?? null,
      m.asset?.mime_type ?? null,
      m.asset?.size_bytes ?? null,
      m.external_url ?? null,
      referenzHash(m),
    ]),
  );
}

// ── Anhang-Wächter (Spec 8.2, 8.4, 8.6) ──

/** Logzeile T17 (Info): Änderung einer beobachteten Liste nach ihrer ersten Beobachtung. */
export const TEXT_ANHAENGE_GEAENDERT = (titel: string, n: number): string => `iveo: Anhänge von „${titel}“ geändert, jetzt ${n}.`;

/** Höchstens so viele Kennungen je Anmeldung über `iveo:watchMaterials`, je höchstens so viele Zeichen (8.6). */
export const BEOBACHTUNG_MAX = 8;
export const BEOBACHTUNG_KENNUNG_MAX = 200;

/**
 * Eingabe von `iveo:watchMaterials` prüfen (8.6): `{programIds}` mit höchstens 8 nicht leeren Kennungen zu je höchstens
 * 200 Zeichen; sonst null (verworfen). Doppelte zählen einmal.
 */
export function pruefeBeobachtung(input: unknown): string[] | null {
  const ids = (input as { programIds?: unknown } | null | undefined)?.programIds;
  if (!Array.isArray(ids) || ids.length > BEOBACHTUNG_MAX) return null;
  for (const id of ids as unknown[]) {
    if (typeof id !== 'string' || id === '' || id.length > BEOBACHTUNG_KENNUNG_MAX) return null;
  }
  return [...new Set(ids as string[])];
}

/** Ereignis an den Renderer (8.4, AppEvent `iveo-anhaenge`). */
export interface AnhangEreignis {
  type: 'iveo-anhaenge';
  programId: string;
  abgerufen: string;
  ok: boolean;
  materials?: IveoMaterialRef[];
  error?: string;
  /** Nur bei ok:false: Beginn des gescheiterten Versuchs (Fix-Runde 2, Task 7); der Renderer verwirft damit überholte Fehlschläge. */
  begann?: string;
}

/** Abhängigkeiten des Wächters; die Hülle (iveo-sync.ts, Task 28) reicht sie ein. */
export interface AnhangWaechterAbh {
  /** programId des aktiven Side Events (`kern().aktiv()?.filter.programId`), sonst null (Listen-Modus, keine Show). */
  aktivProgramId(): string | null;
  /** Event-Slug der offenen Show, sonst null. */
  event(): string | null;
  jetztIso(): string;
  sende(e: AnhangEreignis): void;
  /** Titel aus der Bindung bzw. dem Cache für T17; null → die programId. */
  titelVon(programId: string): string | null;
  log: { info(m: string): void };
}

export interface AnhangWaechter {
  /** Ersetzt die Beobachtung des Renderers (aufgeklappte Liste) und sendet 8.4 Nr. 3 für jede beobachtete Liste mit Stand. */
  beobachte(programIds: string[]): void;
  /** Agenda des aktiven Side Events aus der Abfrage des Kerns (meldeAgenda, 8.2), ohne eigenen Abruf. */
  agendaVomKern(programId: string, e: AgendaErgebnis): void;
  /**
   * Der Renderer hat die Liste selbst geladen und dabei seinen Fehler gelöscht (`listSideEventMaterials` gelungen, Abruf
   * begann `abgerufen`; Task 28): Der nächste Fehlschlag eines danach begonnenen Abrufs wird wieder gesendet, auch mit
   * gleichem Text (EP20). Nur für eine beobachtete Liste; kein Ereignis, kein Abruf.
   */
  eigenesLaden(programId: string, abgerufen: string): void;
  /** Holt im Takt die Agenda jeder beobachteten Liste, die nicht das aktive Side Event ist (15-s-Client der Hülle). */
  takt(client: Pick<IveoClient, 'listAgendaItems'> | null): Promise<void>;
  /** Show geöffnet, gewechselt, geschlossen oder mit neuer Bindung gespeichert: alle Stände und Marken vergessen, die Beobachtung des Renderers bleibt (8.2). */
  zuruecksetzen(): void;
}

/** Stand einer Liste im Main: letzte gelungene Prüfung (Signatur, Liste, Zeit) und der Fehlertext der letzten, falls sie scheiterte. */
interface ListenStand {
  sig: string | null;
  materials: IveoMaterialRef[] | null;
  abgerufen: string | null;
  fehler: string | null;
}

/**
 * Anhang-Wächter (8.2): beobachtet die vom Renderer gemeldete Liste und das aktive Side Event. Ereignisse nach 8.4:
 * (1) nach jeder gelungenen Prüfung `ok: true`, `materials` nur bei der ersten Beobachtung, einer neuen Materialsignatur
 * und nach „gescheitert → gelungen“; (2) beim Wechsel auf „gescheitert“ und bei jedem neuen Fehlertext `ok: false`;
 * (3) auf jede Anmeldung für jede beobachtete Liste mit Stand, mit `materials`. Ein gleicher Fehler sendet nichts, außer als
 * erster Fehlschlag eines Abrufs, der nach einer Anmeldung der Liste oder nach dem Beginn eines gelungenen eigenen Ladens
 * des Renderers begann (EP20, 11.3 L3).
 */
export function erzeugeAnhangWaechter(d: AnhangWaechterAbh): AnhangWaechter {
  const staende = new Map<string, ListenStand>();
  let beobachtet: string[] = [];
  let generation = 0;
  /**
   * Ausnahme von „gleicher Fehler → kein Ereignis“ (EP20): Listen, deren nächster Fehlschlag gesendet wird, auch mit gleichem
   * Text, je mit der Marke (ms), ab der sie gilt: die Anmeldung (`beobachte`) bzw. der Beginn eines gelungenen eigenen Ladens
   * (`eigenesLaden`). Der Renderer lädt eine angemeldete Liste selbst und löscht bei Erfolg seinen Fehler (Task 7); ohne die
   * Ausnahme zeigte er L5 trotz Störung (11.3 L3). Einlösen darf sie nur ein Fehlschlag, dessen Abruf nach der Marke begann;
   * ein älterer gleicher Fehler bleibt still und lässt sie stehen (sonst verbrauchte ihn ein Abruf von vor der Anmeldung, und
   * das danach gelungene eigene Laden ließe L5 trotz Störung stehen).
   */
  const neuMelden = new Map<string, number>();
  /**
   * Begann der Abruf eines Fehlschlags nach der Marke seiner Liste? Dieselbe Millisekunde zählt als davor (dann löst der
   * nächste Abruf ein); ohne lesbaren Beginn oder Marke ja (die Diagnose kommt eher einmal zu oft als nie).
   */
  const nachMarke = (programId: string, abgerufen: string | undefined): boolean => {
    const marke = neuMelden.get(programId);
    if (marke === undefined) return false;
    const t = abgerufen === undefined ? Number.NaN : Date.parse(abgerufen);
    return !Number.isFinite(t) || !Number.isFinite(marke) || t > marke;
  };

  const alleBeobachteten = (): string[] => {
    const a = d.aktivProgramId();
    return a !== null && !beobachtet.includes(a) ? [...beobachtet, a] : [...beobachtet];
  };

  function verarbeite(programId: string, e: AgendaErgebnis): void {
    const alt = staende.get(programId);
    if (e.ok) {
      const sig = materialSignatur(e.agenda);
      const materials = materialienAusAgenda(e.agenda);
      const erste = alt === undefined || alt.abgerufen === null;
      const geaendert = alt !== undefined && !erste && alt.sig !== sig;
      const mitListe = erste || geaendert || (alt !== undefined && alt.fehler !== null);
      if (geaendert) d.log.info(TEXT_ANHAENGE_GEAENDERT(d.titelVon(programId) ?? programId, materials.length));
      staende.set(programId, { sig, materials, abgerufen: e.abgerufen, fehler: null });
      d.sende({ type: 'iveo-anhaenge', programId, abgerufen: e.abgerufen, ok: true, ...(mitListe ? { materials } : {}) });
      return;
    }
    const text = toClientError(e.fehler).error;
    const einloesen = nachMarke(programId, e.abgerufen);
    if (alt !== undefined && alt.fehler === text && !einloesen) return;
    if (einloesen) neuMelden.delete(programId);
    const neu: ListenStand = alt !== undefined ? { ...alt, fehler: text } : { sig: null, materials: null, abgerufen: null, fehler: text };
    staende.set(programId, neu);
    // abgerufen = Zeit der letzten gelungenen Prüfung (8.4); '' = noch keine gelungen.
    d.sende({ type: 'iveo-anhaenge', programId, abgerufen: neu.abgerufen ?? '', ok: false, error: text, ...(e.abgerufen ? { begann: e.abgerufen } : {}) });
  }

  return {
    beobachte(programIds) {
      beobachtet = [...programIds];
      const seit = Date.parse(d.jetztIso());
      for (const id of beobachtet) neuMelden.set(id, seit);
      for (const id of alleBeobachteten()) {
        const st = staende.get(id);
        if (st === undefined || st.abgerufen === null || st.materials === null) continue;
        d.sende({
          type: 'iveo-anhaenge',
          programId: id,
          abgerufen: st.abgerufen,
          ok: st.fehler === null,
          materials: st.materials,
          ...(st.fehler !== null ? { error: st.fehler } : {}),
        });
      }
    },
    agendaVomKern(programId, e) {
      if (!alleBeobachteten().includes(programId)) return;
      verarbeite(programId, e);
    },
    eigenesLaden(programId, abgerufen) {
      if (!alleBeobachteten().includes(programId)) return;
      neuMelden.set(programId, Date.parse(abgerufen));
    },
    async takt(client) {
      const event = d.event();
      if (client === null || event === null) return;
      const gen = generation;
      const aktiv = d.aktivProgramId();
      for (const id of [...beobachtet]) {
        if (id === aktiv) continue;
        // Zeitpunkt VOR dem Abruf (wie der Kern, Spec 6.1): ein langsamer Abruf macht seine Daten nicht jünger.
        const abgerufen = d.jetztIso();
        let e: AgendaErgebnis;
        try {
          e = { ok: true, agenda: await client.listAgendaItems(event, id), abgerufen };
        } catch (fehler) {
          e = { ok: false, fehler, abgerufen };
        }
        if (gen !== generation) return;
        if (!beobachtet.includes(id)) continue;
        verarbeite(id, e);
      }
    },
    zuruecksetzen() {
      generation++;
      staende.clear();
      neuMelden.clear();
      // `beobachtet` bleibt: der Renderer meldet nur bei Öffnen/Schließen, Auf-/Zuklappen und Event-Wechsel neu (8.2).
    },
  };
}

// ── Ende des Moduls ──
