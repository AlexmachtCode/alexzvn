// ─────────────────────────────────────────────────────────────────────────────
// Show-Editor: was beim Speichern in die .jmshow geht (Master-Link Teil 2a, Spec 7.5).
//
// Der Editor baute die Show beim Speichern bisher neu und verlor dabei Tool-
// Einstellungen (eigene Timer-Liste, Presenter-PIN …), `network.port` und
// `iveo.syncedAt` und rundete Dauern auf ganze Minuten. `baueGespeicherteShow`
// geht deshalb von der GELADENEN Show aus und überschreibt nur, was das Formular
// zeigt — und auch das nur, wenn es im Formular geändert wurde.
//
// Rein: zur Laufzeit nur `@jm/show` (keine Electron-, keine Alias-Importe) → läuft
// im Renderer und im tsx-Test (test/show-speichern.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

import {
  createShow,
  type Show,
  type ShowAblaufItem,
  type ShowIveoBinding,
  type ShowIveoProgramRef,
  type ShowIveoSpeaker,
  type ShowToolRef,
} from '@jm/show';

/** Eine Zeile des zentralen Ablaufs im Editor (#78; Kennungen Spec 3.3, Dauern 7.5). */
export interface AblaufZeile {
  /** Feste Kennung des Ablaufpunkts: iveo-ID oder beim Anlegen erzeugt (Spec 3.2). */
  id?: string;
  label: string;
  /** Dauer in Minuten als Eingabe-Text (z. B. "5" oder "2.5"). Leer = ohne Dauer. */
  minutes: string;
  /** Freie Notiz. */
  note: string;
  /**
   * Durchreich-Felder aus einer iveo-Bindung (#11/Sub-B/Sub-C, F1): im Editor nicht
   * editierbar, müssen den Editor aber unverändert durchlaufen.
   */
  plannedStartMs?: number;
  owner?: string;
  category?: string;
  /** Geladene Dauer in ms — wird sekundengenau geschrieben, solange `minutes` unverändert bleibt. */
  geladenDurationMs?: number;
  /** Der aus `geladenDurationMs` erzeugte Minuten-Text (Vergleichswert für `minutes`). */
  geladenMinutes?: string;
}

/** Stand des Show-Editor-Formulars beim Speichern. */
export interface FormularStand {
  /** Name im Formular; leer = „Unbenannte Show“. */
  name: string;
  /** Gewählte Tools in Formular-Reihenfolge. */
  tools: Array<{ appId: string; document: string; host: string }>;
  ablauf: AblaufZeile[];
  battle: { nameA: string; nameB: string; rounds: string };
  /** Q&A-Redezeit in Sekunden als Eingabe-Text. */
  qaSpeak: string;
  /** Nur gesetzt, wenn in diesem Editor neu gebunden wurde („Ablauf übernehmen“). */
  iveoNeuGebunden: ShowIveoBinding | null;
}

/** iveo-Bindung, wie der Editor sie anzeigt (token-frei). */
export interface EditorBindung {
  event: string;
  name: string;
  baseUrl?: string;
  speakers?: ShowIveoSpeaker[];
  sideEvents?: ShowIveoProgramRef[];
  filter?: ShowIveoBinding['filter'];
}

type ToolZeile = FormularStand['tools'][number];

const UNBENANNT = 'Unbenannte Show';

/** Dauer → Minuten-Text der Editor-Zeile (wie bisher auf ganze Minuten gerundet). */
function minutenText(durationMs: number | undefined): string {
  return durationMs ? String(Math.round(durationMs / 60000)) : '';
}

/** Ablaufpunkte (aus der Show oder dem Bind-Ergebnis) → Editor-Zeilen; Kennung und Dauer laufen mit. */
export function zeilenAusAblauf(ablauf: ShowAblaufItem[] | undefined): AblaufZeile[] {
  return (ablauf ?? []).map((a) => {
    const minutes = minutenText(a.durationMs);
    return {
      ...(a.id ? { id: a.id } : {}),
      label: a.label,
      minutes,
      note: a.note ?? '',
      // 0 ist ein gültiger plannedStartMs-Wert (00:00 Uhr).
      ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
      ...(a.owner ? { owner: a.owner } : {}),
      ...(a.category ? { category: a.category } : {}),
      ...(typeof a.durationMs === 'number' ? { geladenDurationMs: a.durationMs } : {}),
      geladenMinutes: minutes,
    };
  });
}

/** Szenario-Vorlage → Editor-Zeilen; jede Zeile bekommt beim Übernehmen eine Kennung (Spec 3.2). */
export function zeilenAusSeed(
  seed: Array<{ label: string; minutes?: number; note?: string }> | undefined,
  neueId: () => string,
): AblaufZeile[] {
  return (seed ?? []).map((a) => ({
    id: neueId(),
    label: a.label,
    minutes: a.minutes != null ? String(a.minutes) : '',
    note: a.note ?? '',
  }));
}

/** Formularstand, den eine geladene Show im Editor ergibt („Bestehende öffnen…“). */
export function formularAusShow(show: Show): FormularStand {
  const battle = show.tools.find((t) => t.appId === 'jm-battle')?.settings;
  const qa = show.tools.find((t) => t.appId === 'jm-qa')?.settings;
  return {
    name: show.name === UNBENANNT ? '' : show.name,
    tools: show.tools.map((t) => ({ appId: t.appId, document: t.document ?? '', host: t.network?.host ?? '' })),
    ablauf: zeilenAusAblauf(show.ablauf),
    battle: {
      nameA: typeof battle?.nameA === 'string' ? battle.nameA : '',
      nameB: typeof battle?.nameB === 'string' ? battle.nameB : '',
      rounds: typeof battle?.rounds === 'number' ? String(battle.rounds) : '',
    },
    qaSpeak: typeof qa?.speakSeconds === 'number' ? String(qa.speakSeconds) : '',
    iveoNeuGebunden: null,
  };
}

/** Editor-Bindung → token-freie Show-Bindung; leere Listen und ein leerer Filter fallen weg. */
export function bindungAusEditor(b: EditorBindung): ShowIveoBinding {
  const f = b.filter;
  return {
    event: b.event,
    name: b.name,
    ...(b.baseUrl ? { baseUrl: b.baseUrl } : {}),
    ...(b.speakers?.length ? { speakers: b.speakers } : {}),
    ...(b.sideEvents?.length ? { sideEvents: b.sideEvents } : {}),
    ...(f && (f.typeSlug || f.formatSlug || f.day || f.excludeBlockers || f.programId) ? { filter: f } : {}),
  };
}

/** Minuten-Text unverändert → geladene Dauer sekundengenau; sonst die Eingabe (Spec 7.5). */
function dauerAusZeile(r: AblaufZeile): number | undefined {
  if (r.geladenMinutes !== undefined && r.minutes === r.geladenMinutes) return r.geladenDurationMs;
  const min = parseFloat(r.minutes);
  return Number.isFinite(min) && min > 0 ? Math.round(min * 60000) : undefined;
}

/** Editor-Zeilen → Ablaufpunkte (Titel Pflicht); Zeilen ohne Kennung bekommen `neueId()`. */
export function baueAblauf(zeilen: AblaufZeile[], neueId: () => string): ShowAblaufItem[] {
  return zeilen
    .filter((r) => r.label.trim())
    .map((r) => {
      const durationMs = dauerAusZeile(r);
      const note = r.note.trim();
      return {
        id: r.id ?? neueId(),
        label: r.label.trim(),
        ...(durationMs ? { durationMs } : {}),
        ...(note ? { note } : {}),
        ...(typeof r.plannedStartMs === 'number' ? { plannedStartMs: r.plannedStartMs } : {}),
        ...(r.owner ? { owner: r.owner } : {}),
        ...(r.category ? { category: r.category } : {}),
      };
    });
}

/** Hat sich der Ablauf im Formular gegenüber dem Laden verändert? (Kennung, Titel, Minuten, Notiz) */
function gleicheZeilen(a: AblaufZeile[], b: AblaufZeile[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => r.id === b[i].id && r.label === b[i].label && r.minutes === b[i].minutes && r.note === b[i].note)
  );
}

/** Battle-Einstellungen eines neu gewählten Tools (wie bisher). */
function battleEinstellungen(b: FormularStand['battle']): Record<string, unknown> | undefined {
  const s: Record<string, unknown> = {};
  if (b.nameA.trim()) s.nameA = b.nameA.trim();
  if (b.nameB.trim()) s.nameB = b.nameB.trim();
  const r = parseInt(b.rounds, 10);
  if (Number.isFinite(r) && r > 0) s.rounds = r;
  return Object.keys(s).length ? s : undefined;
}

/** Ein im Formular neu gewähltes Tool (oder jedes Tool einer neuen Show) — wie bisher gebaut. */
function neuesTool(t: ToolZeile, f: FormularStand): ShowToolRef {
  const ref: ShowToolRef = { appId: t.appId };
  const doc = t.document.trim();
  if (doc) ref.document = doc;
  const host = t.host.trim();
  if (host) ref.network = { host };
  if (t.appId === 'jm-battle') {
    const s = battleEinstellungen(f.battle);
    if (s) ref.settings = s;
  }
  if (t.appId === 'jm-qa') {
    const sec = parseInt(f.qaSpeak, 10);
    if (Number.isFinite(sec) && sec > 0) ref.settings = { speakSeconds: sec };
  }
  return ref;
}

function setzeText(s: Record<string, unknown>, key: string, wert: string): void {
  const v = wert.trim();
  if (v) s[key] = v;
  else delete s[key];
}
function setzeZahl(s: Record<string, unknown>, key: string, wert: string): void {
  const n = parseInt(wert, 10);
  if (Number.isFinite(n) && n > 0) s[key] = n;
  else delete s[key];
}

/** Ein schon geladenes Tool: nur im Formular geänderte Felder anfassen, alle anderen bleiben. */
function aktualisiereTool(ref: ShowToolRef, vorher: ToolZeile | undefined, t: ToolZeile, basis: FormularStand, f: FormularStand): ShowToolRef {
  const out: ShowToolRef = { ...ref };
  if (t.document !== (vorher?.document ?? '')) {
    const doc = t.document.trim();
    if (doc) out.document = doc;
    else delete out.document;
  }
  if (t.host !== (vorher?.host ?? '')) {
    const network = { ...(ref.network ?? {}) };
    const host = t.host.trim();
    if (host) network.host = host;
    else delete network.host;
    if (network.host !== undefined || network.port !== undefined) out.network = network;
    else delete out.network;
  }
  if (ref.appId === 'jm-battle') {
    const b = basis.battle;
    const n = f.battle;
    if (n.nameA !== b.nameA || n.nameB !== b.nameB || n.rounds !== b.rounds) {
      const s: Record<string, unknown> = { ...(ref.settings ?? {}) };
      if (n.nameA !== b.nameA) setzeText(s, 'nameA', n.nameA);
      if (n.nameB !== b.nameB) setzeText(s, 'nameB', n.nameB);
      if (n.rounds !== b.rounds) setzeZahl(s, 'rounds', n.rounds);
      if (Object.keys(s).length) out.settings = s;
      else delete out.settings;
    }
  }
  if (ref.appId === 'jm-qa' && f.qaSpeak !== basis.qaSpeak) {
    const s: Record<string, unknown> = { ...(ref.settings ?? {}) };
    setzeZahl(s, 'speakSeconds', f.qaSpeak);
    if (Object.keys(s).length) out.settings = s;
    else delete out.settings;
  }
  return out;
}

/** Tool-Liste: abgewählte fallen weg, geladene behalten Reihenfolge und Felder, neue kommen ans Ende. */
function baueTools(alt: ShowToolRef[], basis: FormularStand, f: FormularStand): ShowToolRef[] {
  const imFormular = new Map(f.tools.map((t) => [t.appId, t]));
  const out: ShowToolRef[] = [];
  const drin = new Set<string>();
  for (const ref of alt) {
    const t = imFormular.get(ref.appId);
    if (!t) continue; // im Formular abgewählt
    drin.add(ref.appId);
    out.push(aktualisiereTool(ref, basis.tools.find((b) => b.appId === ref.appId), t, basis, f));
  }
  for (const t of f.tools) {
    if (drin.has(t.appId)) continue;
    drin.add(t.appId);
    out.push(neuesTool(t, f));
  }
  return out;
}

/**
 * Spec 7.5 Regel 1: gebunden, nicht neu gebunden, Ablauf im Formular unverändert → Ablauf und Bindung kommen aus der
 * Datei, wie sie JETZT ist (eine iveo-Abfrage kann sie seit dem Laden neu geschrieben haben).
 */
export function regelEinsGreift(geladen: Show | null, f: FormularStand): boolean {
  return !!geladen?.iveo && !f.iveoNeuGebunden && gleicheZeilen(f.ablauf, formularAusShow(geladen).ablauf);
}

/** Beschriftung des Speichern-Knopfs beim Bearbeiten — nur dort kann Regel 1 ablehnen. Die Meldung nennt ihn wörtlich. */
export const KNOPF_AKTUALISIEREN = 'Aktualisieren';
/** Beschriftung des Knopfs, den der Editor nach einer Ablehnung anbietet (Owner-Entscheidung 2026-10-02). */
export const KNOPF_TROTZDEM_SPEICHERN = 'Trotzdem speichern';

/**
 * Schlüssel eines Formularstands samt Datei. Das Angebot „Trotzdem speichern“ gilt nur, solange der Editor noch genau
 * den abgelehnten Stand zeigt — jede Änderung im Formular (oder eine andere Datei) ergibt einen anderen Schlüssel.
 */
export function formularSchluessel(pfad: string | null, f: FormularStand): string {
  return JSON.stringify([pfad, f]);
}

/**
 * Meldung, wenn Regel 1 die aktuelle Datei braucht und sie nicht lesbar ist (Text außerhalb der Spec; vom Owner
 * freigegeben, der Schluss 2026-10-02 auf die Knöpfe umgestellt). Was der letzte Satz über iveo sagt, ist im Kern
 * gemessen (test/iveo-abgleich.test.ts, Block „Trotzdem speichern“): Side Event im Detail → die nächste Abfrage
 * schreibt den iveo-Stand zurück; Listen-Modus → die nächste Abfrage, wenn der Abgleich wegen der unlesbaren Datei noch
 * etwas nicht schreiben konnte, sonst erst, wenn iveo ein geändertes Programm meldet (Abfragefenster bleibt,
 * iveo-abgleich-kern.ts offeneShowGespeichert). Läuft die Show nicht in diesem Launcher, gleicht hier niemand ab.
 * Nachbesserung 2026-10-02 (Prüfer): „Trotzdem speichern“ liest die Datei noch einmal (ShowEditorModal onSave) — ist sie
 * dann lesbar, gilt Regel 1 mit ihr, der Stand vom Öffnen wird NICHT geschrieben; darum steht er im Text nur bedingt.
 * Der Stand vom Öffnen enthält den Filter, also die damalige Side-Event-Auswahl (baueGespeicherteShow: {...geladen}).
 * Der Kern übernimmt den Filter aus der Datei (iveo-abgleich-kern.ts setzeAuf) und schickt RELOAD — eine Live-Umschaltung
 * seit dem Öffnen (Panel oder LAUNCHER SIDEEVENT) ist danach zurückgenommen und kommt nie von selbst zurück (gemessen,
 * test/iveo-abgleich.test.ts „Trotzdem/Umschaltung“). Der Satz über iveo-Änderungen gilt für diese Auswahl.
 */
export const TEXT_SPEICHERN_DATEI_NICHT_LESBAR =
  'Show nicht gespeichert: Die Show-Datei ist gerade nicht lesbar, sonst gingen iveo-Änderungen seit dem Öffnen verloren (Details im Launcher-Log). ' +
  `„${KNOPF_AKTUALISIEREN}“ versucht es erneut. „${KNOPF_TROTZDEM_SPEICHERN}“ liest die Datei noch einmal; ist sie weiter nicht lesbar, ` +
  'schreibt es Ablauf und iveo-Bindung vom Öffnen des Editors, auch die Side-Event-Auswahl von damals. ' +
  'Läuft die Show gerade in diesem Launcher, holt der iveo-Abgleich die iveo-Änderungen spätestens zurück, sobald sich in iveo ein Programmpunkt ändert.';

/**
 * Speichern ablehnen? Greift Regel 1, ist die aktuelle Datei aber nicht lesbar (null), schriebe das Speichern still den
 * Ablauf vom Öffnen des Editors — und im Listen-Modus heilte das erst die nächste iveo-Änderung. Dann nicht speichern,
 * sondern die Meldung zeigen. `geladen` = null bei einer neuen Show. Sonst null = speichern.
 * `trotzdem` = der Bediener hat nach der Ablehnung „Trotzdem speichern“ gewählt: nie ablehnen. Der Aufrufer hat die
 * Datei dafür noch einmal gelesen — ist sie jetzt lesbar, gilt Regel 1 mit ihr, sonst schreibt baueGespeicherteShow
 * Ablauf und Bindung vom Öffnen des Editors.
 */
export function speichernAbgelehnt(geladen: Show | null, f: FormularStand, aktuelleDatei: Show | null, trotzdem = false): string | null {
  if (trotzdem) return null;
  return aktuelleDatei === null && regelEinsGreift(geladen, f) ? TEXT_SPEICHERN_DATEI_NICHT_LESBAR : null;
}

/**
 * Show zum Speichern bauen (Spec 7.5).
 * - `geladen` = die beim Öffnen gelesene Show (null bei einer neuen Show).
 * - `aktuelleDatei` = dieselbe Datei, wie sie JETZT auf der Platte liegt (null, wenn
 *   nicht lesbar) — eine iveo-Abfrage kann sie seit dem Laden neu geschrieben haben.
 * - `neueId` = Kennung für Ablaufzeilen ohne `id`.
 */
export function baueGespeicherteShow(geladen: Show | null, f: FormularStand, aktuelleDatei: Show | null, neueId: () => string): Show {
  if (!geladen) {
    const ablauf = baueAblauf(f.ablauf, neueId);
    return {
      ...createShow(f.name.trim() || UNBENANNT),
      tools: f.tools.map((t) => neuesTool(t, f)),
      ...(ablauf.length ? { ablauf } : {}),
      ...(f.iveoNeuGebunden ? { iveo: f.iveoNeuGebunden } : {}),
    };
  }
  const basis = formularAusShow(geladen);
  const show: Show = { ...geladen, tools: baueTools(geladen.tools, basis, f) };
  if (f.name !== basis.name) show.name = f.name.trim() || UNBENANNT;
  const ablaufGleich = gleicheZeilen(f.ablauf, basis.ablauf);
  if (regelEinsGreift(geladen, f) && aktuelleDatei) {
    // Regel 1: gleiche Bindung, Ablauf unverändert → Ablauf und Bindung so, wie sie
    // JETZT in der Datei stehen. Eine iveo-Abfrage seit dem Laden bleibt erhalten.
    if (aktuelleDatei.ablauf) show.ablauf = aktuelleDatei.ablauf;
    else delete show.ablauf;
    if (aktuelleDatei.iveo) show.iveo = aktuelleDatei.iveo;
    else delete show.iveo;
    return show;
  }
  if (!ablaufGleich || f.iveoNeuGebunden) {
    const ablauf = baueAblauf(f.ablauf, neueId);
    if (ablauf.length) show.ablauf = ablauf;
    else delete show.ablauf;
  }
  if (f.iveoNeuGebunden) show.iveo = f.iveoNeuGebunden;
  return show;
}
