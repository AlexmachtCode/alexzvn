import { useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import { createShow, type Show, type ShowAblaufItem, type ShowIveoSpeaker, type ShowToolRef } from '@jm/show';
import type { IveoEventStub } from '@shared/types';
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
}

const EMPTY_ENTRY: Entry = { included: false, document: '', host: '' };

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

  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [ablauf, setAblauf] = useState<AblaufRow[]>([]);
  const [battleA, setBattleA] = useState('');
  const [battleB, setBattleB] = useState('');
  const [battleRounds, setBattleRounds] = useState('');
  const [qaSpeak, setQaSpeak] = useState('');
  const [busy, setBusy] = useState(false);

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
  } | null>(null);
  const [iveoBusy, setIveoBusy] = useState(false);
  const [iveoMsg, setIveoMsg] = useState<string | null>(null);

  if (!open) return null;

  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const selectedCount = Object.values(entries).filter((e) => e.included).length;
  const canSave = selectedCount > 0 && !busy;

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
    if (!iveoToken.trim()) {
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

  /** Gewähltes Event binden: Token verschlüsselt ablegen + Ablauf übernehmen. */
  const bindIveo = async (): Promise<void> => {
    const event = iveoSelected.trim();
    if (!iveoToken.trim() || !event) {
      setIveoMsg('Token und Event erforderlich.');
      return;
    }
    setIveoBusy(true);
    setIveoMsg(null);
    try {
      const res = await window.jmps.bindIveoEvent({
        token: iveoToken.trim(),
        baseUrl: iveoBaseUrl.trim() || undefined,
        event,
      });
      if (!res.ok) {
        setIveoMsg(res.error ?? 'Ablauf konnte nicht geladen werden.');
        return;
      }
      const rows: AblaufRow[] = (res.ablauf ?? []).map((a) => ({
        label: a.label,
        minutes: a.durationMs ? String(Math.round(a.durationMs / 60000)) : '',
        note: a.note ?? '',
      }));
      setAblauf(rows);
      const bound = { event: res.event?.slug ?? event, name: res.event?.name ?? event };
      const speakers = res.speakers ?? [];
      setIveoBinding({
        ...bound,
        baseUrl: iveoBaseUrl.trim() || undefined,
        ...(speakers.length ? { speakers } : {}),
      });
      setIveoMsg(
        `„${bound.name}" übernommen — ${rows.length} Programmpunkte, ${speakers.length} Speaker (Titler).` +
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
            },
          }
        : {}),
    };
    setBusy(true);
    try {
      const ok = await saveShow(show);
      if (ok) {
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
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Show anlegen</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Tools für die Produktion auswählen und als .jmshow speichern. Beim Öffnen startet
            der Launcher alle gewählten Tools und gibt jedem seinen Teil mit.
          </p>
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
              placeholder="iveo-Token (iveo_live_…)"
              autoComplete="off"
              onChange={(e) => setIveoToken(e.target.value)}
              className={cn(inputCls, 'h-8 px-2.5 text-xs')}
            />
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
            <Button variant="ghost" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={() => void onSave()}>
              {busy ? 'Speichere…' : 'Speichern'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
