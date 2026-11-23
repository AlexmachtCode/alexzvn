import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, cn, Modal } from '@jm/ui';
import type { MediaItem, OutputTime, ShowCue } from '@shared/types';
import { usePlayer } from '@/store/player';
import { formatDuration } from '@/lib/format';
import { istEingabeZiel } from '@/lib/oberflaeche';
import { LiveBereich } from './LiveBereich';

/**
 * Cue-Show. `onAusgabe` öffnet das Einstellungs-Panel beim Abschnitt Ausgabe (UX Welle 2a, Player d1: das Modal
 * „Video-Ausgabe“ ist dort aufgegangen); „▦ Ausgabe“ bleibt der Zugang im Kopf der Cue-Show. Unten steht der Live-Bereich
 * (Standby und Transport als TallyButtons, Player d2); eine Fußleiste hat die Cue-Show nicht (W2-10).
 */
export function ShowView({ onAusgabe }: { onAusgabe: () => void }) {
  const shows = usePlayer((s) => s.shows);
  const activeShowId = usePlayer((s) => s.activeShowId);
  const showCues = usePlayer((s) => s.showCues);
  const standbyIndex = usePlayer((s) => s.standbyIndex);
  const playingCueIds = usePlayer((s) => s.playingCueIds);
  const vorlaufCueIds = usePlayer((s) => s.vorlaufCueIds);
  const showPaused = usePlayer((s) => s.showPaused);
  const videoProgress = usePlayer((s) => s.videoProgress);
  const videoCue = usePlayer((s) => s.videoCue);
  const outputDisplayId = usePlayer((s) => s.outputDisplayId);

  const createShow = usePlayer((s) => s.createShow);
  const renameShow = usePlayer((s) => s.renameShow);
  const removeShow = usePlayer((s) => s.removeShow);
  const selectShow = usePlayer((s) => s.selectShow);
  const removeShowCue = usePlayer((s) => s.removeShowCue);
  const reorderShow = usePlayer((s) => s.reorderShow);
  const setStandby = usePlayer((s) => s.setStandby);
  const showGo = usePlayer((s) => s.showGo);
  const showStop = usePlayer((s) => s.showStop);
  const showPanic = usePlayer((s) => s.showPanic);
  const showTogglePause = usePlayer((s) => s.showTogglePause);

  const [addOpen, setAddOpen] = useState(false);
  const [editCue, setEditCue] = useState<ShowCue | null>(null);
  // Stabile Schließen-Rückrufe: Modal meldet sich bei jedem neuen onClose neu an und holte den Fokus sonst bei jeder
  // Store-Änderung (Videofortschritt ~4×/s) zurück auf das erste Feld.
  const schliesseHinzufuegen = useCallback(() => setAddOpen(false), []);
  const schliesseCue = useCallback(() => setEditCue(null), []);

  // Beim ersten Betreten die erste Show wählen.
  useEffect(() => {
    if (activeShowId == null && shows.length > 0) void selectShow(shows[0].id);
  }, [activeShowId, shows, selectShow]);

  // Leertaste = GO, Escape = Stop (außer in Eingabefeldern / bei offenem Dialog). Das Einstellungs-Panel ist kein Dialog:
  // Leertaste auf einem Panel-Knopf geht ans Tool (O1); Escape schließt das Panel und kommt hier nicht an (panelTaste).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (addOpen || editCue) return;
      if (istEingabeZiel(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        showGo();
      } else if (e.key === 'Escape') {
        showStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen, editCue, showGo, showStop]);

  const newShow = async (): Promise<void> => {
    await createShow(`Show ${shows.length + 1}`);
  };

  if (shows.length === 0) {
    return (
      <div className="h-full grid place-items-center px-8">
        <div className="text-center max-w-sm">
          <h3 className="text-base font-extrabold">Noch keine Show</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Lege eine Cue-Show an, reihe Medien als Cues und fahre sie live per <b>GO</b> ab —
            mit Pre-Wait, Auto-Continue und Fades (QLab-Stil).
          </p>
          <Button size="sm" variant="primary" className="mt-5" onClick={() => void newShow()}>
            Show anlegen
          </Button>
        </div>
      </div>
    );
  }

  const move = (index: number, dir: -1 | 1): void => {
    const target = index + dir;
    if (target < 0 || target >= showCues.length) return;
    const ids = showCues.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorderShow(ids);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Kopf: Show-Auswahl */}
      <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-[var(--border)]/60">
        <select
          value={activeShowId ?? ''}
          onChange={(e) => void selectShow(Number(e.target.value))}
          className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold"
        >
          {shows.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => void newShow()}>
          + Neu
        </Button>
        {activeShowId != null && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const name = window.prompt('Show umbenennen', shows.find((s) => s.id === activeShowId)?.name ?? '');
                if (name) void renameShow(activeShowId, name);
              }}
            >
              Umbenennen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm('Diese Show löschen?')) void removeShow(activeShowId);
              }}
            >
              Löschen
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onAusgabe}>
            ▦ Ausgabe
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            + Cue
          </Button>
        </div>
      </div>

      {/* Cue-Liste */}
      <div className="flex-1 overflow-auto scroll-thin px-5 py-4">
        {showCues.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-sm text-[var(--muted-foreground)]">
            <div>
              Noch keine Cues. Füge mit <b>+ Cue</b> Medien aus der Bibliothek hinzu.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {showCues.map((cue, i) => (
              <CueRow
                key={cue.id}
                index={i}
                cue={cue}
                standby={i === standbyIndex}
                playing={playingCueIds.includes(cue.id)}
                onSelect={() => setStandby(i)}
                onEdit={() => setEditCue(cue)}
                onRemove={() => void removeShowCue(cue.id)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Laufendes Ausgabe-Video: Position + Restzeit (#41) */}
      {videoProgress && videoProgress.duration > 0 && (
        <VideoProgress
          progress={videoProgress}
          label={
            showCues.find((c) => c.id === videoCue?.id)?.label ||
            showCues.find((c) => c.id === videoCue?.id)?.media?.fileName ||
            'Video'
          }
        />
      )}

      {/* Live-Bereich: Standby und Transport (Pause/Weiter, Stop, Panik, GO ganz rechts wie bisher; Ruling W36) mit denselben
          Store-Aktionen wie bisher */}
      <LiveBereich
        stand={{
          player: { activeShowId, showCues, standbyIndex, playingCueIds, vorlaufCueIds, showPaused, videoCue, videoProgress, outputDisplayId },
        }}
        aktionen={{ showGo, showTogglePause, showStop, showPanic }}
      />

      {addOpen && activeShowId != null && <AddCuesModal onClose={schliesseHinzufuegen} />}
      {editCue && <CueSettingsModal cue={editCue} onClose={schliesseCue} />}
    </div>
  );
}

function CueRow({
  index,
  cue,
  standby,
  playing,
  onSelect,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  cue: ShowCue;
  standby: boolean;
  playing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const missing = cue.media == null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-3 rounded-[var(--radius)] border px-3 py-2 cursor-pointer select-none transition-colors',
        playing
          ? 'border-[var(--primary)] bg-[var(--primary)]/15'
          : standby
            ? 'border-[var(--primary)]/60 bg-[var(--highlight)]'
            : 'border-[var(--border)] hover:bg-[var(--highlight)]',
      )}
    >
      <span
        className={cn(
          'grid place-items-center size-7 shrink-0 rounded text-xs font-extrabold tabular',
          standby ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--card)] text-[var(--muted-foreground)]',
        )}
      >
        {playing ? '►' : index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-bold', missing && 'text-[var(--destructive)]')}>
          {cue.label || cue.media?.fileName || (missing ? 'Medium fehlt' : '—')}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--muted-foreground)]">
          {cue.media && (
            <span>
              {cue.media.kind === 'audio' ? '♪' : '▦'} {formatDuration(cue.media.durationSec)}
            </span>
          )}
          {cue.preWaitSec > 0 && <Badge>⏱ {fmt(cue.preWaitSec)}s</Badge>}
          {cue.fadeInSec > 0 && <Badge>↗ {fmt(cue.fadeInSec)}s</Badge>}
          {cue.fadeOutSec > 0 && <Badge>↘ {fmt(cue.fadeOutSec)}s</Badge>}
          {cue.gainDb !== 0 && <Badge>{cue.gainDb > 0 ? '+' : ''}{fmt(cue.gainDb)} dB</Badge>}
          {cue.loop && <Badge>∞ Loop</Badge>}
          {cue.autoContinue && <Badge>→ Auto</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <IconBtn title="Nach oben" onClick={onMoveUp}>▲</IconBtn>
        <IconBtn title="Nach unten" onClick={onMoveDown}>▼</IconBtn>
        <IconBtn title="Einstellungen" onClick={onEdit}>⚙</IconBtn>
        <IconBtn title="Entfernen" onClick={onRemove}>✕</IconBtn>
      </div>
    </div>
  );
}

/** Dialog „Cue bearbeiten“ (Modal aus @jm/ui; exportiert für die Render-Tests). */
export function CueSettingsModal({ cue, onClose }: { cue: ShowCue; onClose: () => void }) {
  const updateShowCue = usePlayer((s) => s.updateShowCue);
  const [label, setLabel] = useState(cue.label);
  const [preWait, setPreWait] = useState(cue.preWaitSec);
  const [fadeIn, setFadeIn] = useState(cue.fadeInSec);
  const [fadeOut, setFadeOut] = useState(cue.fadeOutSec);
  const [gainDb, setGainDb] = useState(cue.gainDb);
  const [loop, setLoop] = useState(cue.loop);
  const [autoContinue, setAutoContinue] = useState(cue.autoContinue);

  const save = async (): Promise<void> => {
    await updateShowCue(cue.id, {
      label: label.trim() || cue.media?.fileName || 'Cue',
      preWaitSec: Math.max(0, preWait),
      fadeInSec: Math.max(0, fadeIn),
      fadeOutSec: Math.max(0, fadeOut),
      gainDb,
      loop,
      autoContinue,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose} className="w-full max-w-md">
      <h2 className="text-lg font-extrabold tracking-tight">Cue bearbeiten</h2>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{cue.media?.fileName ?? 'Medium fehlt'}</p>

      <div className="mt-5 flex flex-col gap-4">
        <Field label="Beschriftung">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={cue.media?.fileName ?? 'Cue-Name'}
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <NumField label="Pre-Wait (s)" value={preWait} step={0.5} min={0} onChange={setPreWait} />
          <NumField label="Fade-In (s)" value={fadeIn} step={0.5} min={0} onChange={setFadeIn} />
          <NumField label="Fade-Out (s)" value={fadeOut} step={0.5} min={0} onChange={setFadeOut} />
        </div>

        <div className="flex items-end gap-4">
          <NumField label="Gain (dB)" value={gainDb} step={1} onChange={setGainDb} />
          <label className="flex items-center gap-2 h-10 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Loop
          </label>
          <label className="flex items-center gap-2 h-10 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={autoContinue} onChange={(e) => setAutoContinue(e.target.checked)} />
            Auto-Continue
          </label>
        </div>
        {loop && autoContinue && (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Hinweis: Loop-Cues enden nie von selbst — Auto-Continue greift dann nicht.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button size="sm" variant="primary" onClick={() => void save()}>
          Speichern
        </Button>
      </div>
    </Modal>
  );
}

/** Dialog „Cues hinzufügen“ (Modal aus @jm/ui; exportiert für die Render-Tests). */
export function AddCuesModal({ onClose }: { onClose: () => void }) {
  const items = usePlayer((s) => s.items);
  const addShowCues = usePlayer((s) => s.addShowCues);
  const [selected, setSelected] = useState<number[]>([]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.fileName.localeCompare(b.fileName)),
    [items],
  );

  const toggle = (id: number): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const add = async (): Promise<void> => {
    if (selected.length === 0) return;
    await addShowCues(selected);
    onClose();
  };

  return (
    <Modal onClose={onClose} className="w-full max-w-lg">
      <h2 className="text-lg font-extrabold tracking-tight">Cues hinzufügen</h2>
      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
        Medien aus der Bibliothek auswählen — sie werden ans Ende der Show angehängt.
      </p>

      <div className="mt-4 max-h-[50vh] overflow-auto scroll-thin rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
        {sorted.length === 0 && (
          <p className="p-4 text-sm text-[var(--muted-foreground)]">Bibliothek ist leer.</p>
        )}
        {sorted.map((m: MediaItem) => (
          <label key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--highlight)]">
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
            <span className="shrink-0">{m.kind === 'audio' ? '♪' : '▦'}</span>
            <span className="truncate flex-1">{m.fileName}</span>
            <span className="shrink-0 text-[11px] text-[var(--muted-foreground)] tabular">
              {formatDuration(m.durationSec)}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button size="sm" variant="primary" disabled={selected.length === 0} onClick={() => void add()}>
          Hinzufügen{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </div>
    </Modal>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Live-Laufzeit als mm:ss (immer, auch bei 0 — anders als formatDuration). */
function clock(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function VideoProgress({ progress, label }: { progress: OutputTime; label: string }) {
  const { currentTime, duration } = progress;
  const remaining = Math.max(0, duration - currentTime);
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="shrink-0 border-t border-[var(--border)]/60 bg-[var(--card)]/30 px-5 pt-2.5 pb-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-bold tabular">
        <span className="min-w-0 truncate text-[var(--foreground)]">▦ {label}</span>
        <span className="shrink-0 text-[var(--muted-foreground)]">
          {clock(currentTime)} / {clock(duration)}
          <span className="ml-2 text-[var(--primary)]">noch −{clock(remaining)}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--muted)]">
        <div
          className="h-full rounded-[var(--radius-full)] bg-[var(--primary)] transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[var(--card)] border border-[var(--border)] px-1.5 py-px font-bold tabular">
      {children}
    </span>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid place-items-center size-7 rounded text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)] text-xs"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={String(value)}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm tabular"
      />
    </Field>
  );
}
