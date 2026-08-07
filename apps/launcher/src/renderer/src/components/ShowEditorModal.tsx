import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import {
  createShow,
  type Show,
  type ShowAblaufItem,
  type ShowIveoProgramRef,
  type ShowIveoSpeaker,
  type ShowToolRef,
} from '@jm/show';
import type { IveoEventStub, IveoProgramRef, IveoProgramTaxonomy } from '@shared/types';
import { useTools } from '@/store/tools';

interface Entry {
  included: boolean;
  document: string;
  /** Optionaler Host, auf dem das Tool läuft (→ network.host). Leer = dieser PC. */
  host: string;
}

/** Eine Zeile des zentralen Show-Ablaufs (#78) im Editor. */
interface AblaufRow {
  label: string;
  /** Dauer in Minuten als Eingabe-String (z. B. "5" oder "2.5"). Leer = ohne Dauer. */
  minutes: string;
  /** Freie Notiz (optional). */
  note: string;
  /**
   * Reine Durchreich-Felder aus einer iveo-Bindung (#11/Sub-B/Sub-C) — im Editor
   * NICHT editierbar (keine UI dafür), aber müssen den Editor unverändert
   * durchlaufen, sonst gehen Soll-Zeit/Verantwortlich/Kategorie beim Speichern
   * verloren (F1: der Editor ist der einzige Schreiber nach einem Bind).
   */
  plannedStartMs?: number;
  owner?: string;
  category?: string;
}

const EMPTY_ENTRY: Entry = { included: false, document: '', host: '' };

/** YYYY-MM-DD → „Mo, 11.11.2024" (lokal geparst, ohne TZ-Verschiebung). */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const wd = new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short' });
  return `${wd}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

const inputCls = cn(
  'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
  'text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

export function ShowEditorModal() {
  const open = useTools((s) => s.showEditorOpen);
  const tools = useTools((s) => s.tools);
  const close = useTools((s) => s.closeShowEditor);
  const saveShow = useTools((s) => s.saveShow);
  const editorSeed = useTools((s) => s.editorSeed);
  const clearEditorSeed = useTools((s) => s.clearEditorSeed);

  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [ablauf, setAblauf] = useState<AblaufRow[]>([]);
  const [battleA, setBattleA] = useState('');
  const [battleB, setBattleB] = useState('');
  const [battleRounds, setBattleRounds] = useState('');
  const [qaSpeak, setQaSpeak] = useState('');
  const [busy, setBusy] = useState(false);
  // Bearbeiten (statt neu): Pfad der geladenen Show — Speichern schreibt dorthin zurück.
  const [editPath, setEditPath] = useState<string | null>(null);

  // iveo-Event-Bindung (#11). Token bleibt nur transient hier im Feld; der Main-
  // Prozess legt ihn beim Binden verschlüsselt ab und gibt ihn NIE zurück.
  const [iveoToken, setIveoToken] = useState('');
  const [iveoBaseUrl, setIveoBaseUrl] = useState('');
  const [iveoEvents, setIveoEvents] = useState<IveoEventStub[] | null>(null);
  const [iveoSelected, setIveoSelected] = useState('');
  const [iveoBinding, setIveoBinding] = useState<{
    event: string;
    name: string;
    baseUrl?: string;
    speakers?: ShowIveoSpeaker[];
    sideEvents?: ShowIveoProgramRef[];
    filter?: { typeSlug?: string; formatSlug?: string; day?: string; excludeBlockers?: boolean; programId?: string };
  } | null>(null);
  const [iveoBusy, setIveoBusy] = useState(false);
  const [iveoMsg, setIveoMsg] = useState<string | null>(null);
  // Ablauf-Filter (#11): nach Tag (mehrtägige iveo-Pläne → ein Tag), Typ/Format
  // und optional ohne „Blocker"-Platzhalter — z. B. „nur die Side Events dieses Tages".
  const [iveoDay, setIveoDay] = useState('');
  const [iveoExcludeBlockers, setIveoExcludeBlockers] = useState(false);
  const [iveoTypeSlug, setIveoTypeSlug] = useState('');
  const [iveoFormatSlug, setIveoFormatSlug] = useState('');
  const [iveoProgramTypes, setIveoProgramTypes] = useState<IveoProgramTaxonomy | null>(null);
  // Ein einzelnes Side Event „im Detail" (#11 Phase 3b): Ablauf = dessen Agenda,
  // Bauchbinden = dessen Speaker. Leer = Tages-/Listenmodus.
  const [iveoProgramId, setIveoProgramId] = useState('');
  const [iveoProgramList, setIveoProgramList] = useState<IveoProgramRef[]>([]);
  // C4: Ist für die im Feld stehende Basis-URL schon ein Token gemerkt? Dann darf
  // das Token-Feld leer bleiben — der Main-Prozess nutzt den gespeicherten (nie im Renderer).
  const [iveoBaseTokenSaved, setIveoBaseTokenSaved] = useState(false);

  // Szenario-Start (B2): einen vom Szenario-Picker gesetzten Seed einmalig ins
  // Formular übernehmen (Tools vorwählen, Ablauf/Redezeit/Runden vorbefüllen) und
  // danach verbrauchen — nutzt denselben Formular-State wie „Bestehende öffnen".
  useEffect(() => {
    if (!open || !editorSeed) return;
    setName(editorSeed.name);
    setEntries(
      Object.fromEntries(
        editorSeed.toolIds.map((id) => [id, { included: true, document: '', host: '' }]),
      ),
    );
    setAblauf(
      (editorSeed.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.minutes != null ? String(a.minutes) : '',
        note: a.note ?? '',
      })),
    );
    setQaSpeak(editorSeed.qaSpeakSeconds != null ? String(editorSeed.qaSpeakSeconds) : '');
    setBattleRounds(editorSeed.battleRounds != null ? String(editorSeed.battleRounds) : '');
    setEditPath(null);
    clearEditorSeed();
  }, [open, editorSeed, clearEditorSeed]);

  // C4: prüfen, ob für die aktuelle Basis-URL schon ein Token hinterlegt ist
  // (nur Boolean — der Token-Wert bleibt im Main-Prozess). Erlaubt „Events laden"
  // und „Ablauf übernehmen" mit leerem Feld für ein weiteres Event derselben Org.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void window.jmps.hasIveoBaseToken(iveoBaseUrl.trim() || undefined).then((has) => {
      if (!cancelled) setIveoBaseTokenSaved(has);
    });
    return () => {
      cancelled = true;
    };
  }, [open, iveoBaseUrl]);

  if (!open) return null;

  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const selectedCount = Object.values(entries).filter((e) => e.included).length;
  const canSave = selectedCount > 0 && !busy;
  // Side-Event-Auswahl auf den gewählten Tag eingrenzen (sonst alle Programme).
  const dayPrograms = iveoProgramList.filter((p) => !iveoDay || p.day === iveoDay);

  const setEntry = (id: string, patch: Partial<Entry>): void =>
    setEntries((prev) => ({
      ...prev,
      [id]: { ...EMPTY_ENTRY, ...prev[id], ...patch },
    }));

  const pickDoc = async (id: string): Promise<void> => {
    const path = await window.jmps.pickShowDocument();
    if (path) setEntry(id, { included: true, document: path });
  };

  const addAblaufRow = (): void =>
    setAblauf((rows) => [...rows, { label: '', minutes: '', note: '' }]);
  const setAblaufRow = (i: number, patch: Partial<AblaufRow>): void =>
    setAblauf((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeAblaufRow = (i: number): void =>
    setAblauf((rows) => rows.filter((_, idx) => idx !== i));

  /** Token prüfen + lesbare Events auflisten (Token wird noch nicht gespeichert). */
  const discoverIveo = async (): Promise<void> => {
    if (!iveoToken.trim() && !iveoBaseTokenSaved) {
      setIveoMsg('Bitte iveo-Token einfügen.');
      return;
    }
    setIveoBusy(true);
    setIveoMsg(null);
    try {
      const res = await window.jmps.discoverIveoEvents({
        token: iveoToken.trim(),
        baseUrl: iveoBaseUrl.trim() || undefined,
      });
      if (!res.ok) {
        setIveoEvents(null);
        setIveoMsg(res.error ?? 'Verbindung fehlgeschlagen.');
        return;
      }
      const events = res.events ?? [];
      setIveoEvents(events);
      if (events.length) setIveoSelected(events[0].slug);
      setIveoMsg(events.length ? `${events.length} Event(s) lesbar.` : 'Token gültig, aber keine Events im Scope.');
    } finally {
      setIveoBusy(false);
    }
  };

  /**
   * Gewähltes Event binden: Token verschlüsselt ablegen + (gefilterten) Ablauf
   * übernehmen. `override` erlaubt es, ein gerade geändertes Filter-Kriterium sofort
   * anzuwenden (React-State ist beim onChange noch nicht aktualisiert).
   */
  const bindIveo = async (
    override: Partial<{ typeSlug: string; formatSlug: string; day: string; excludeBlockers: boolean; programId: string }> = {},
  ): Promise<void> => {
    const event = iveoSelected.trim();
    if ((!iveoToken.trim() && !iveoBaseTokenSaved) || !event) {
      setIveoMsg('Token und Event erforderlich.');
      return;
    }
    const typeSlug = override.typeSlug ?? iveoTypeSlug;
    const formatSlug = override.formatSlug ?? iveoFormatSlug;
    const day = override.day ?? iveoDay;
    const excludeBlockers = override.excludeBlockers ?? iveoExcludeBlockers;
    const programId = override.programId ?? iveoProgramId;
    setIveoBusy(true);
    setIveoMsg(null);
    try {
      const res = await window.jmps.bindIveoEvent({
        token: iveoToken.trim(),
        baseUrl: iveoBaseUrl.trim() || undefined,
        event,
        typeSlug: typeSlug || undefined,
        formatSlug: formatSlug || undefined,
        day: day || undefined,
        excludeBlockers: excludeBlockers || undefined,
        programId: programId || undefined,
      });
      if (!res.ok) {
        setIveoMsg(res.error ?? 'Ablauf konnte nicht geladen werden.');
        return;
      }
      // Der Bind hat den Token basis-weit gemerkt (Main) → Feld darf künftig leer bleiben.
      setIveoBaseTokenSaved(true);
      const rows: AblaufRow[] = (res.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.durationMs ? String(Math.round(a.durationMs / 60000)) : '',
        note: a.note ?? '',
        // Durchreich-Felder aus iveo (F1) — im Editor nicht sichtbar/editierbar,
        // müssen aber bis buildAblauf() erhalten bleiben (0 ist gültig = 00:00 Uhr).
        ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
        ...(a.owner ? { owner: a.owner } : {}),
        ...(a.category ? { category: a.category } : {}),
      }));
      setAblauf(rows);
      if (res.programTypes) setIveoProgramTypes(res.programTypes);
      if (res.programList) setIveoProgramList(res.programList);
      const bound = { event: res.event?.slug ?? event, name: res.event?.name ?? event };
      const speakers = res.speakers ?? [];
      // Im Agenda-Modus (ein Side Event) zählen Tag/Typ/Format nicht mit — nur programId.
      const filter = programId
        ? { programId }
        : {
            ...(typeSlug ? { typeSlug } : {}),
            ...(formatSlug ? { formatSlug } : {}),
            ...(day ? { day } : {}),
            ...(excludeBlockers ? { excludeBlockers: true } : {}),
          };
      setIveoBinding({
        ...bound,
        baseUrl: iveoBaseUrl.trim() || undefined,
        ...(speakers.length ? { speakers } : {}),
        ...(res.sideEvents?.length ? { sideEvents: res.sideEvents } : {}),
        ...(Object.keys(filter).length ? { filter } : {}),
      });
      let filterLabel: string;
      if (programId) {
        const title = iveoProgramList.find((p) => p.id === programId)?.title ?? 'Side Event';
        filterLabel = `Side Event „${title}" (Agenda)`;
      } else {
        const labelParts: string[] = [];
        if (day) labelParts.push(day);
        if (typeSlug) labelParts.push(typeSlug);
        if (formatSlug) labelParts.push(formatSlug);
        if (excludeBlockers) labelParts.push('ohne Blocker');
        filterLabel = labelParts.length ? labelParts.join(', ') : 'alle';
      }
      setIveoMsg(
        `„${bound.name}" übernommen — ${rows.length} Programmpunkte (Filter: ${filterLabel}), ${speakers.length} Speaker (Titler).` +
          (res.warning ? ` ⚠ ${res.warning}` : ''),
      );
    } finally {
      setIveoBusy(false);
    }
  };

  /** Editor-Zeilen → zentrale Show-Ablauf-Items (Titel Pflicht, Dauer/Notiz optional). */
  const buildAblauf = (): ShowAblaufItem[] =>
    ablauf
      .filter((r) => r.label.trim())
      .map((r) => {
        const min = parseFloat(r.minutes);
        const durationMs = Number.isFinite(min) && min > 0 ? Math.round(min * 60000) : undefined;
        const note = r.note.trim();
        return {
          label: r.label.trim(),
          ...(durationMs ? { durationMs } : {}),
          ...(note ? { note } : {}),
          // Durchreich-Felder aus iveo (F1): nicht editierbar, aber müssen erhalten
          // bleiben — 0 ist ein gültiger plannedStartMs-Wert (00:00 Uhr).
          ...(typeof r.plannedStartMs === 'number' ? { plannedStartMs: r.plannedStartMs } : {}),
          ...(r.owner ? { owner: r.owner } : {}),
          ...(r.category ? { category: r.category } : {}),
        };
      });

  const buildRef = (id: string): ShowToolRef => {
    const e = entries[id];
    const ref: ShowToolRef = { appId: id };
    const doc = e?.document.trim();
    if (doc) ref.document = doc;
    const host = e?.host.trim();
    if (host) ref.network = { host };
    if (id === 'jm-battle') {
      const s: Record<string, unknown> = {};
      if (battleA.trim()) s.nameA = battleA.trim();
      if (battleB.trim()) s.nameB = battleB.trim();
      const r = parseInt(battleRounds, 10);
      if (Number.isFinite(r) && r > 0) s.rounds = r;
      if (Object.keys(s).length) ref.settings = s;
    }
    if (id === 'jm-qa') {
      const sec = parseInt(qaSpeak, 10);
      if (Number.isFinite(sec) && sec > 0) ref.settings = { speakSeconds: sec };
    }
    return ref;
  };

  /** Alle Formularfelder leeren (nach Speichern / Abbrechen / „Neu"). */
  const resetForm = (): void => {
    setName('');
    setEntries({});
    setAblauf([]);
    setBattleA('');
    setBattleB('');
    setBattleRounds('');
    setQaSpeak('');
    setIveoToken('');
    setIveoBaseUrl('');
    setIveoEvents(null);
    setIveoSelected('');
    setIveoBinding(null);
    setIveoMsg(null);
    setIveoDay('');
    setIveoExcludeBlockers(false);
    setIveoTypeSlug('');
    setIveoFormatSlug('');
    setIveoProgramTypes(null);
    setIveoProgramId('');
    setIveoProgramList([]);
    setEditPath(null);
  };

  const cancel = (): void => {
    resetForm();
    close();
  };

  /** Bestehende .jmshow laden und das Formular damit füllen (Bearbeiten). */
  const loadForEdit = async (): Promise<void> => {
    const r = await window.jmps.loadShowForEdit();
    if (!r) return;
    const { path, show } = r;
    resetForm();
    setEditPath(path);
    setName(show.name === 'Unbenannte Show' ? '' : show.name);
    const next: Record<string, Entry> = {};
    for (const ref of show.tools) {
      next[ref.appId] = { included: true, document: ref.document ?? '', host: ref.network?.host ?? '' };
    }
    setEntries(next);
    setAblauf(
      (show.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.durationMs ? String(Math.round(a.durationMs / 60000)) : '',
        note: a.note ?? '',
        // Durchreich-Felder aus iveo (F1) — s. Kommentar in bindIveo().
        ...(typeof a.plannedStartMs === 'number' ? { plannedStartMs: a.plannedStartMs } : {}),
        ...(a.owner ? { owner: a.owner } : {}),
        ...(a.category ? { category: a.category } : {}),
      })),
    );
    const battle = show.tools.find((t) => t.appId === 'jm-battle')?.settings as
      | Record<string, unknown>
      | undefined;
    setBattleA(typeof battle?.nameA === 'string' ? battle.nameA : '');
    setBattleB(typeof battle?.nameB === 'string' ? battle.nameB : '');
    setBattleRounds(typeof battle?.rounds === 'number' ? String(battle.rounds) : '');
    const qa = show.tools.find((t) => t.appId === 'jm-qa')?.settings as Record<string, unknown> | undefined;
    setQaSpeak(typeof qa?.speakSeconds === 'number' ? String(qa.speakSeconds) : '');
    setIveoBinding(
      show.iveo
        ? {
            event: show.iveo.event,
            name: show.iveo.name ?? show.iveo.event,
            baseUrl: show.iveo.baseUrl,
            speakers: show.iveo.speakers,
            sideEvents: show.iveo.sideEvents,
            filter: show.iveo.filter,
          }
        : null,
    );
  };

  const onSave = async (): Promise<void> => {
    const ablaufItems = buildAblauf();
    const show: Show = {
      ...createShow(name.trim() || 'Unbenannte Show'),
      tools: sorted.filter((t) => entries[t.id]?.included).map((t) => buildRef(t.id)),
      ...(ablaufItems.length ? { ablauf: ablaufItems } : {}),
      // Token-freie iveo-Bindung (nur Slug/Name/Base-URL) — für das Live-Polling.
      ...(iveoBinding
        ? {
            iveo: {
              event: iveoBinding.event,
              name: iveoBinding.name,
              ...(iveoBinding.baseUrl ? { baseUrl: iveoBinding.baseUrl } : {}),
              ...(iveoBinding.speakers?.length ? { speakers: iveoBinding.speakers } : {}),
              ...(iveoBinding.sideEvents?.length ? { sideEvents: iveoBinding.sideEvents } : {}),
              ...(iveoBinding.filter &&
              (iveoBinding.filter.typeSlug ||
                iveoBinding.filter.formatSlug ||
                iveoBinding.filter.day ||
                iveoBinding.filter.excludeBlockers ||
                iveoBinding.filter.programId)
                ? { filter: iveoBinding.filter }
                : {}),
            },
          }
        : {}),
    };
    setBusy(true);
    try {
      const ok = await saveShow(show, editPath ?? undefined);
      if (ok) {
        resetForm();
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="-mr-2 max-h-[68vh] overflow-y-auto pr-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight">
              {editPath ? 'Show bearbeiten' : 'Show anlegen'}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {editPath
                ? 'Tools an-/abwählen, Ablauf und iveo anpassen und in dieselbe Datei zurückspeichern.'
                : 'Tools für die Produktion auswählen und als .jmshow speichern. Beim Öffnen startet der Launcher alle gewählten Tools und gibt jedem seinen Teil mit.'}
            </p>
            {editPath && (
              <p className="mt-1 text-[10px] text-[var(--muted-foreground)] truncate" title={editPath}>
                {editPath.split(/[\\/]/).pop()}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => void loadForEdit()}>
            Bestehende öffnen…
          </Button>
        </div>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            Name der Show
          </span>
          <input
            value={name}
            placeholder="z. B. Gottesdienst 10 Uhr"
            onChange={(e) => setName(e.target.value)}
            className={cn(inputCls, 'h-10 px-3 text-sm')}
          />
        </label>

        {/* iveo-Event (#11): Ablauf + Metadaten aus der Eventplattform übernehmen.
            Das per-Event-Token bleibt verschlüsselt im Launcher — nie in der Show. */}
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            iveo-Event (optional)
          </span>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
            Token pro Event aus iveo einfügen → Ablauf wird unten übernommen und während der
            Show live nachgezogen. Das Token bleibt verschlüsselt im Launcher, nie in der Show-Datei.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <input
              type="password"
              value={iveoToken}
              placeholder={iveoBaseTokenSaved ? 'Token gemerkt — leer lassen zum Wiederverwenden' : 'iveo-Token (iveo_live_…)'}
              autoComplete="off"
              onChange={(e) => setIveoToken(e.target.value)}
              className={cn(inputCls, 'h-8 px-2.5 text-xs')}
            />
            {iveoBaseTokenSaved && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                ✓ Token für diese Basis gemerkt — Feld leer lassen, um es für ein weiteres Event
                derselben Veranstaltung wiederzuverwenden.
              </span>
            )}
            <div className="flex items-center gap-2">
              <input
                value={iveoBaseUrl}
                placeholder="Basis-URL (leer = Standard/Staging)"
                onChange={(e) => setIveoBaseUrl(e.target.value)}
                className={cn(inputCls, 'h-8 flex-1 px-2.5 text-xs')}
              />
              <Button size="sm" variant="outline" disabled={iveoBusy} onClick={() => void discoverIveo()}>
                {iveoBusy ? '…' : 'Events laden'}
              </Button>
            </div>
            {iveoEvents && iveoEvents.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={iveoSelected}
                  onChange={(e) => setIveoSelected(e.target.value)}
                  className={cn(inputCls, 'h-8 min-w-0 flex-1 px-2 text-xs')}
                >
                  {iveoEvents.map((ev) => (
                    <option key={ev.id} value={ev.slug}>
                      {ev.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="primary"
                  className="shrink-0"
                  disabled={iveoBusy}
                  onClick={() => void bindIveo()}
                >
                  Ablauf übernehmen
                </Button>
              </div>
            )}
            {iveoProgramTypes &&
              (iveoProgramTypes.days.length > 1 ||
                iveoProgramTypes.types.length > 1 ||
                iveoProgramTypes.formats.length > 1 ||
                iveoProgramTypes.blockerCount > 0) && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                      Ablauf-Filter — z. B. nur die Side Events eines Tages
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-6 px-2 text-[10px]"
                      disabled={iveoBusy}
                      title="Filter zurücksetzen und den gesamten Event-Ablauf übernehmen"
                      onClick={() => {
                        setIveoDay('');
                        setIveoTypeSlug('');
                        setIveoFormatSlug('');
                        setIveoExcludeBlockers(false);
                        setIveoProgramId('');
                        void bindIveo({ day: '', typeSlug: '', formatSlug: '', excludeBlockers: false, programId: '' });
                      }}
                    >
                      Ganze Veranstaltung
                    </Button>
                  </div>
                  {/* Tag: wichtigster Filter — mehrtägige iveo-Pläne auf einen Tag eingrenzen. */}
                  {iveoProgramTypes.days.length > 1 && (
                    <select
                      value={iveoDay}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIveoDay(v);
                        // Tageswechsel hebt eine Side-Event-Detailauswahl auf (anderer Tag).
                        setIveoProgramId('');
                        void bindIveo({ day: v, programId: '' });
                      }}
                      className={cn(inputCls, 'h-8 min-w-0 w-full px-2 text-xs')}
                    >
                      <option value="">Alle Tage (kein Tagesfilter)</option>
                      {iveoProgramTypes.days.map((d) => (
                        <option key={d.value} value={d.value}>
                          {formatDay(d.value)} — {d.count} Punkt(e)
                        </option>
                      ))}
                    </select>
                  )}
                  {(iveoProgramTypes.types.length > 1 || iveoProgramTypes.formats.length > 1) && (
                    <div className="flex items-center gap-2">
                      {iveoProgramTypes.types.length > 1 && (
                        <select
                          value={iveoTypeSlug}
                          onChange={(e) => {
                            const v = e.target.value;
                            setIveoTypeSlug(v);
                            void bindIveo({ typeSlug: v });
                          }}
                          className={cn(inputCls, 'h-8 min-w-0 flex-1 px-2 text-xs')}
                        >
                          <option value="">Typ: alle</option>
                          {iveoProgramTypes.types.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.value} ({t.count})
                            </option>
                          ))}
                        </select>
                      )}
                      {iveoProgramTypes.formats.length > 1 && (
                        <select
                          value={iveoFormatSlug}
                          onChange={(e) => {
                            const v = e.target.value;
                            setIveoFormatSlug(v);
                            void bindIveo({ formatSlug: v });
                          }}
                          className={cn(inputCls, 'h-8 min-w-0 flex-1 px-2 text-xs')}
                        >
                          <option value="">Format: alle</option>
                          {iveoProgramTypes.formats.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.value} ({f.count})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {iveoProgramTypes.blockerCount > 0 && (
                    <label className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={iveoExcludeBlockers}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setIveoExcludeBlockers(v);
                          void bindIveo({ excludeBlockers: v });
                        }}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      „Blocker"/Platzhalter ausblenden ({iveoProgramTypes.blockerCount})
                    </label>
                  )}
                </div>
              )}
            {/* Ein Side Event „im Detail" (#11 Phase 3b): Ablauf = dessen Agenda,
                Bauchbinden nur dessen Speaker. */}
            {iveoProgramList.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                  Side Event im Detail (Agenda + eigene Speaker)
                </span>
                <select
                  value={iveoProgramId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIveoProgramId(v);
                    void bindIveo({ programId: v });
                  }}
                  className={cn(inputCls, 'h-8 min-w-0 w-full px-2 text-xs')}
                >
                  <option value="">— Kein Detail (Tages-/Listenablauf) —</option>
                  {dayPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {!iveoDay && p.day ? `${p.day} · ${p.title}` : p.title}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  Ablauf = Agenda dieses Side Events; Titler zeigt nur dessen Speaker.
                </span>
              </div>
            )}
            {iveoMsg && <p className="text-[11px] text-[var(--muted-foreground)]">{iveoMsg}</p>}
            {iveoBinding && (
              <p className="text-[11px] font-semibold text-[var(--primary)]">
                Gebunden an „{iveoBinding.name}" — Live-Sync beim Öffnen der Show aktiv.
              </p>
            )}
          </div>
        </div>

        {/* Zentraler Ablauf (#78): einmal hier gepflegt, lesen Rundown + Timer
            automatisch beim Öffnen der Show — kein separater Ablauf je Tool. */}
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
              Zentraler Ablauf
            </span>
            <Button size="sm" variant="ghost" onClick={addAblaufRow}>
              + Programmpunkt
            </Button>
          </div>
          {ablauf.length === 0 ? (
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Optional — Programmpunkte mit Dauer. Rundown &amp; Timer übernehmen sie
              automatisch (Rundown als Zeilen, Timer als Countdown-Ablauf).
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {ablauf.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-right text-[11px] tabular-nums text-[var(--muted-foreground)]">
                    {i + 1}
                  </span>
                  <input
                    value={r.label}
                    placeholder="Programmpunkt (z. B. Begrüßung)"
                    onChange={(e) => setAblaufRow(i, { label: e.target.value })}
                    className={cn(inputCls, 'h-8 flex-1 px-2.5 text-xs')}
                  />
                  <input
                    value={r.minutes}
                    inputMode="decimal"
                    placeholder="Min"
                    onChange={(e) => setAblaufRow(i, { minutes: e.target.value })}
                    className={cn(inputCls, 'h-8 w-14 px-2.5 text-xs tabular-nums')}
                  />
                  <input
                    value={r.note}
                    placeholder="Notiz"
                    onChange={(e) => setAblaufRow(i, { note: e.target.value })}
                    className={cn(inputCls, 'h-8 w-24 px-2.5 text-xs')}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeAblaufRow(i)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          {sorted.map((t) => {
            const entry = entries[t.id];
            const included = entry?.included ?? false;
            return (
              <div
                key={t.id}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => setEntry(t.id, { included: e.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {t.category}
                  </span>
                </label>

                {included && (
                  <div className="mt-2 flex flex-col gap-2 pl-6">
                    <div className="flex items-center gap-2">
                      <input
                        value={entry?.document ?? ''}
                        placeholder="Optional: Dokument (z. B. .jmpres)"
                        onChange={(e) => setEntry(t.id, { document: e.target.value })}
                        className={cn(inputCls, 'h-8 flex-1 px-2.5 text-xs')}
                      />
                      <Button size="sm" variant="ghost" onClick={() => void pickDoc(t.id)}>
                        …
                      </Button>
                    </div>
                    <input
                      value={entry?.host ?? ''}
                      placeholder="Optional: Host / IP (Standard: dieser PC)"
                      onChange={(e) => setEntry(t.id, { host: e.target.value })}
                      className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                    />

                    {t.id === 'jm-timer' && (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Übernimmt den zentralen Ablauf oben als Countdown-Plan.
                      </p>
                    )}

                    {t.id === 'jm-battle' && (
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input
                          value={battleA}
                          placeholder="Kontrahent A"
                          onChange={(e) => setBattleA(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                        />
                        <input
                          value={battleB}
                          placeholder="Kontrahent B"
                          onChange={(e) => setBattleB(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs')}
                        />
                        <input
                          value={battleRounds}
                          inputMode="numeric"
                          placeholder="Runden (z. B. 3)"
                          onChange={(e) => setBattleRounds(e.target.value)}
                          className={cn(inputCls, 'h-8 px-2.5 text-xs col-span-2 tabular-nums')}
                        />
                      </div>
                    )}

                    {t.id === 'jm-qa' && (
                      <input
                        value={qaSpeak}
                        inputMode="numeric"
                        placeholder="Redezeit je Wortmeldung (Sekunden)"
                        onChange={(e) => setQaSpeak(e.target.value)}
                        className={cn(inputCls, 'h-8 px-2.5 text-xs tabular-nums')}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <span className="text-xs text-[var(--muted-foreground)]">
            {selectedCount} Tool(s) gewählt
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={() => void onSave()}>
              {busy ? 'Speichere…' : editPath ? 'Aktualisieren' : 'Speichern'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
