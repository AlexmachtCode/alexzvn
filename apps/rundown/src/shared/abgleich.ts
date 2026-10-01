// Abgleich des Rundown-Dokuments mit dem Show-Ablauf (Master-Link 2a, #235).
//
// Jeder Ablaufpunkt hat einen festen Schlüssel (seine Kennung, sonst eine
// Ersatz-Kennung). Ablaufzeilen tragen ihn als `id`. Der Abgleich hält daran
// Aktionen, Position der eigenen Zeilen und die scharfe Zeile fest (Spec 4.3).
//
// Rein: kein electron, kein node:, keine Uhr, kein Zufall, keine Paket-
// Laufzeitimporte, zwischen Modulen nur `import type` (Selbsttest unter
// `node --experimental-strip-types`). Neue Ablaufzeilen bekommen ihren Schlüssel
// als id; die Funktionen vergeben keine Zufalls-IDs und verändern ihre
// Eingaben nicht.
import type { ShowAblaufItem } from '@jm/show';
import type { RundownRow } from './types';

export interface AbgleichBericht {
  /** lebende Ablaufzeilen mit neuem Titel, Notiz oder Dauer */
  geaendert: number;
  /** neu hinzugekommene Ablaufzeilen (R3) */
  neu: number;
  /** neu als entfallen markiert (R5) */
  entfallen: number;
  /** ohne Aktionen weggefallen (R4) */
  entfernt: number;
  /** vorher entfallen, jetzt wieder lebend (R2) */
  zurueck: number;
  /** lebende Ablaufzeilen, deren Vorgänger unter den lebenden Ablaufzeilen gewechselt hat */
  verschoben: number;
  /** Titel der scharfen Zeile vorher/nachher — nur bei R7 (c) */
  scharfVerrueckt: { von: string; nach: string | null } | null;
}

/** Bericht ohne jede Änderung (R8). Eingefroren, Aufrufer kopieren ihn. */
export const LEERER_BERICHT: AbgleichBericht = Object.freeze({
  geaendert: 0,
  neu: 0,
  entfallen: 0,
  entfernt: 0,
  zurueck: 0,
  verschoben: 0,
  scharfVerrueckt: null,
});

/** true, wenn der Bericht nichts meldet (alle Zähler 0, keine verrückte scharfe Zeile). */
export function berichtIstLeer(b: AbgleichBericht): boolean {
  return (
    b.geaendert === 0 &&
    b.neu === 0 &&
    b.entfallen === 0 &&
    b.entfernt === 0 &&
    b.zurueck === 0 &&
    b.verschoben === 0 &&
    b.scharfVerrueckt === null
  );
}

/**
 * Schlüssel je Ablaufpunkt, in Ablaufreihenfolge (Spec 3.4, 3.5, R9).
 * 1. Punkt mit `id` → die id. Punkt ohne → `ersatz:<Titel>`, beim zweiten
 *    Vorkommen desselben Titels unter den Punkten ohne id `ersatz:<Titel>#2`,
 *    beim dritten `#3` …
 * 2. Danach über die ganze Liste doppelte Schlüssel auflösen: der erste behält
 *    ihn, jeder weitere bekommt `#2`, `#3` … — jeweils die nächste Nummer, die
 *    weder schon vergeben ist noch irgendwo in der Liste als Schlüssel vorkommt.
 *    So behält ein einmaliger Schlüssel immer seinen Wortlaut.
 */
export function ersatzSchluessel(ablauf: ShowAblaufItem[]): string[] {
  const titelZaehler = new Map<string, number>();
  const roh = ablauf.map((p) => {
    if (typeof p.id === 'string' && p.id) return p.id;
    const n = (titelZaehler.get(p.label) ?? 0) + 1;
    titelZaehler.set(p.label, n);
    return n === 1 ? `ersatz:${p.label}` : `ersatz:${p.label}#${n}`;
  });
  return loeseDoppelteAuf(roh);
}

function loeseDoppelteAuf(roh: string[]): string[] {
  const vorhanden = new Set(roh);
  const vergeben = new Set<string>();
  const letzteNummer = new Map<string, number>();
  return roh.map((k) => {
    if (!vergeben.has(k)) {
      vergeben.add(k);
      return k;
    }
    let n = letzteNummer.get(k) ?? 1;
    let kandidat: string;
    do {
      n++;
      kandidat = `${k}#${n}`;
    } while (vergeben.has(kandidat) || vorhanden.has(kandidat));
    letzteNummer.set(k, n);
    vergeben.add(kandidat);
    return kandidat;
  });
}

// ── Abgleich im selben Kontext (Spec 4.3, 4.9) ──────────────────────────────

function istAblaufzeile(r: RundownRow): boolean {
  return r.quelle === 'ablauf';
}

function istEntfallen(r: RundownRow): boolean {
  return r.quelle === 'ablauf' && r.entfallen === true;
}

function kopiereZeile(r: RundownRow): RundownRow {
  return { ...r, actions: r.actions.map((a) => ({ ...a, args: a.args.slice() })) };
}

function alsEigene(r: RundownRow): RundownRow {
  const z = { ...r };
  delete z.quelle;
  delete z.entfallen;
  return z;
}

function zaehle(werte: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of werte) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

/** Dauer wie im Dateiformat: ganze ms > 0, sonst 0 (= ohne). */
function dauerVon(p: ShowAblaufItem): number {
  return typeof p.durationMs === 'number' && p.durationMs > 0 ? Math.trunc(p.durationMs) : 0;
}

/** Weicht der Text der Zeile (Titel, Notiz, Dauer) vom Ablaufpunkt ab? */
function textWeichtAb(z: RundownRow, p: ShowAblaufItem): boolean {
  return z.label !== p.label || (z.note ?? '') !== (p.note ?? '') || (z.durationMs ?? 0) !== dauerVon(p);
}

/** Titel, Notiz und Dauer aus dem Ablaufpunkt übernehmen (R2). */
function uebernimmText(z: RundownRow, p: ShowAblaufItem): void {
  z.label = p.label;
  if (p.note) z.note = p.note;
  else delete z.note;
  const dauer = dauerVon(p);
  if (dauer > 0) z.durationMs = dauer;
  else delete z.durationMs;
}

/** R3: neue Ablaufzeile ohne Aktionen, id = Schlüssel. */
function neueAblaufzeile(k: string, p: ShowAblaufItem): RundownRow {
  const dauer = dauerVon(p);
  return {
    id: k,
    quelle: 'ablauf',
    label: p.label,
    ...(p.note ? { note: p.note } : {}),
    ...(dauer > 0 ? { durationMs: dauer } : {}),
    actions: [],
  };
}

/**
 * 4.9: einmalige Titel-Zuordnung für Version-1-Dokumente. Eine eigene Zeile
 * wird zur Ablaufzeile (id = Schlüssel), wenn ihr Titel im neuen Ablauf und
 * unter den eigenen Zeilen je genau einmal vorkommt. Aktionen bleiben.
 */
function ordneTitelZu(alt: RundownRow[], ablauf: ShowAblaufItem[], schluessel: string[]): RundownRow[] {
  const imAblauf = zaehle(ablauf.map((p) => p.label));
  const unterAlten = zaehle(alt.filter((r) => !istAblaufzeile(r)).map((r) => r.label));
  const zielSchluessel = new Map<string, string>(); // Titel → Schlüssel
  ablauf.forEach((p, i) => {
    if (imAblauf.get(p.label) === 1 && unterAlten.get(p.label) === 1) zielSchluessel.set(p.label, schluessel[i]);
  });
  return alt.map((r) => {
    if (istAblaufzeile(r)) return r;
    const k = zielSchluessel.get(r.label);
    return k === undefined ? r : { ...r, id: k, quelle: 'ablauf' };
  });
}

/**
 * Abwehr kaputter Dokumente: Tragen mehrere alte Ablaufzeilen dieselbe id,
 * gilt nur die erste als Ablaufzeile; jede weitere wird eigene Zeile. So geht
 * keine Zeile verloren und jede id ist unter den Ablaufzeilen eindeutig.
 */
function entdoppleAblaufzeilen(alt: RundownRow[]): RundownRow[] {
  const gesehen = new Set<string>();
  return alt.map((r) => {
    if (!istAblaufzeile(r)) return r;
    if (!gesehen.has(r.id)) {
      gesehen.add(r.id);
      return r;
    }
    return alsEigene(r);
  });
}

/**
 * R0 Titel-Brücke. Verwaist = alte Ablaufzeile (lebend oder entfallen), deren
 * id unter den neuen Schlüsseln fehlt. Ohne Gegenstück = neuer Punkt, dessen
 * Schlüssel unter den alten Ablaufzeilen fehlt. Gleicher Titel, der unter den
 * verwaisten Zeilen UND unter den Punkten ohne Gegenstück je genau einmal
 * vorkommt → die Zeile übernimmt den Schlüssel. Liefert alte id → Schlüssel.
 */
function titelBruecke(alt: RundownRow[], ablauf: ShowAblaufItem[], schluessel: string[]): Map<string, string> {
  const neueSchluessel = new Set(schluessel);
  const alteIds = new Set(alt.filter(istAblaufzeile).map((r) => r.id));
  const verwaist = alt.filter((r) => istAblaufzeile(r) && !neueSchluessel.has(r.id));
  const ohneGegenstueck = ablauf
    .map((p, i) => ({ label: p.label, k: schluessel[i] }))
    .filter(({ k }) => !alteIds.has(k));
  const titelVerwaist = zaehle(verwaist.map((r) => r.label));
  const titelOhne = zaehle(ohneGegenstueck.map(({ label }) => label));
  const bruecke = new Map<string, string>();
  for (const { label, k } of ohneGegenstueck) {
    if (titelOhne.get(label) !== 1 || titelVerwaist.get(label) !== 1) continue;
    const v = verwaist.find((r) => r.label === label);
    if (v) bruecke.set(v.id, k);
  }
  return bruecke;
}

/** Was nach dem Abgleich aus einer alten Zeile wird. */
type Status = 'anker' | 'anhaenger' | 'weg';

/**
 * Abgleich im selben Kontext (Spec 4.3). Reihenfolge:
 * Schlüssel (R9) → Titel-Zuordnung (4.9, nur `altformat`) → R0 → R2/R3 → R4/R5
 * → Aufbau R1+R6 → scharfe Zeile R7 → Bericht (R8 folgt aus den Regeln).
 *
 * `ablauf` ist normalisiert (`normalizeAblauf` aus @jm/show, bzw. über
 * `parseShow`). Die Eingaben werden nicht verändert.
 */
export function gleicheAb(e: {
  alt: RundownRow[];
  ablauf: ShowAblaufItem[];
  scharfId: string | null;
  altformat: boolean;
}): { rows: RundownRow[]; scharfId: string | null; bericht: AbgleichBericht; umbenannt: Record<string, string> } {
  const bericht: AbgleichBericht = { ...LEERER_BERICHT };

  // R9: Schlüssel des neuen Ablaufs.
  const schluessel = ersatzSchluessel(e.ablauf);

  // Kopien der alten Zeilen. Ab hier gilt: alt[j] ist dieselbe Zeile wie e.alt[j],
  // nur mit nachgeführter id/quelle (Index bleibt). Das trägt R6 und R7 (c).
  let alt = e.alt.map(kopiereZeile);
  if (e.altformat) alt = ordneTitelZu(alt, e.ablauf, schluessel);
  alt = entdoppleAblaufzeilen(alt);

  // R0: Titel-Brücke.
  const bruecke = titelBruecke(alt, e.ablauf, schluessel);
  alt = alt.map((r) => {
    const k = istAblaufzeile(r) ? bruecke.get(r.id) : undefined;
    return k === undefined ? r : { ...r, id: k };
  });

  // Vorgänger jeder lebenden Ablaufzeile VOR dem Abgleich (für `verschoben`).
  const vorgaengerAlt = new Map<string, string | null>();
  let vorige: string | null = null;
  for (const r of alt) {
    if (istAblaufzeile(r) && !istEntfallen(r)) {
      vorgaengerAlt.set(r.id, vorige);
      vorige = r.id;
    }
  }

  // R2/R3: jeder Punkt des neuen Ablaufs bekommt genau eine lebende Ablaufzeile.
  const altIndexVon = new Map<string, number>(); // id → Index, nur Ablaufzeilen
  alt.forEach((r, j) => {
    if (istAblaufzeile(r)) altIndexVon.set(r.id, j);
  });
  const status: Status[] = alt.map(() => 'anhaenger');
  const ergebnisZeile: (RundownRow | undefined)[] = alt.map(() => undefined);
  const lebend = new Map<string, RundownRow>(); // Schlüssel → lebende Ablaufzeile
  e.ablauf.forEach((p, i) => {
    const k = schluessel[i];
    const j = altIndexVon.get(k);
    if (j === undefined) {
      lebend.set(k, neueAblaufzeile(k, p)); // R3
      bericht.neu++;
      return;
    }
    // R2: alte Zeile bleibt mit id und actions; Text kommt aus dem Ablauf.
    const vorher = alt[j];
    const z: RundownRow = { ...vorher };
    if (textWeichtAb(vorher, p)) {
      uebernimmText(z, p);
      if (!istEntfallen(vorher)) bericht.geaendert++;
    }
    if (istEntfallen(vorher)) {
      delete z.entfallen;
      bericht.zurueck++;
    }
    lebend.set(k, z);
    status[j] = 'anker';
    ergebnisZeile[j] = z;
  });

  // R4/R5: verwaiste Ablaufzeilen. Eigene Zeilen bleiben unverändert Anhänger.
  alt.forEach((r, j) => {
    if (status[j] === 'anker') return;
    if (!istAblaufzeile(r)) {
      ergebnisZeile[j] = r;
      return;
    }
    if (r.actions.length === 0) {
      status[j] = 'weg'; // R4
      bericht.entfernt++;
      return;
    }
    if (!istEntfallen(r)) bericht.entfallen++; // R5
    ergebnisZeile[j] = istEntfallen(r) ? r : { ...r, entfallen: true };
  });

  // R6: Anker eines Anhängers = nächste Zeile ÜBER ihm (alte Reihenfolge), die
  // NACH dem Abgleich lebende Ablaufzeile ist (status 'anker'). Entfallene und
  // verschwundene Zeilen sind kein Anker.
  const oben: RundownRow[] = [];
  const anhaengerVon = new Map<string, RundownRow[]>();
  let anker: string | null = null;
  alt.forEach((r, j) => {
    if (status[j] === 'anker') {
      anker = r.id;
      return;
    }
    const z = ergebnisZeile[j];
    if (status[j] === 'weg' || !z) return;
    if (anker === null) {
      oben.push(z);
      return;
    }
    const liste = anhaengerVon.get(anker);
    if (liste) liste.push(z);
    else anhaengerVon.set(anker, [z]);
  });

  // R1: lebende Ablaufzeilen in Ablaufreihenfolge, je mit ihren Anhängern;
  // Anhänger ohne Anker ganz oben.
  const rows: RundownRow[] = [...oben];
  for (const k of schluessel) {
    const z = lebend.get(k);
    if (z) rows.push(z);
    rows.push(...(anhaengerVon.get(k) ?? []));
  }

  // verschoben: lebend vorher und nachher, Vorgänger unter den lebenden Ablaufzeilen gewechselt.
  let vorigeNeu: string | null = null;
  for (const k of schluessel) {
    if (vorgaengerAlt.has(k) && vorgaengerAlt.get(k) !== vorigeNeu) bericht.verschoben++;
    vorigeNeu = k;
  }

  // R7: scharfe Zeile über die id.
  const nichtEntfallen = (z: RundownRow | undefined): z is RundownRow => z !== undefined && !istEntfallen(z);
  const iScharf = e.scharfId === null ? -1 : e.alt.findIndex((r) => r.id === e.scharfId);
  let scharfId: string | null;
  if (iScharf < 0) {
    // (a) keine oder unbekannte scharfe Zeile → erste nicht entfallene.
    scharfId = rows.find((z) => nichtEntfallen(z))?.id ?? null;
  } else if (nichtEntfallen(ergebnisZeile[iScharf])) {
    // (b) bleibt als lebende Ablaufzeile oder eigene Zeile erhalten (auch über R0/4.9).
    scharfId = (ergebnisZeile[iScharf] as RundownRow).id;
  } else {
    // (c) entfallen oder verschwunden → erste Zeile, die in der ALTEN Reihenfolge
    // hinter ihr stand und im Ergebnis nicht entfallen ist; sonst die letzte
    // nicht entfallene des Ergebnisses; sonst null.
    let nach: RundownRow | undefined;
    for (let j = iScharf + 1; j < alt.length && !nach; j++) {
      if (nichtEntfallen(ergebnisZeile[j])) nach = ergebnisZeile[j];
    }
    if (!nach) nach = [...rows].reverse().find((z) => nichtEntfallen(z));
    scharfId = nach?.id ?? null;
    bericht.scharfVerrueckt = { von: e.alt[iScharf].label, nach: nach?.label ?? null };
  }

  return { rows, scharfId, bericht, umbenannt: Object.fromEntries(bruecke) };
}
