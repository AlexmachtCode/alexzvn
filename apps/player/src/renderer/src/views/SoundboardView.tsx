import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, cn, Modal } from '@jm/ui';
import type { Cue, MediaItem } from '@shared/types';
import { usePlayer } from '@/store/player';
import { cueEngine } from '@/lib/cues';
import { formatDuration } from '@/lib/format';
import { istEingabeZiel } from '@/lib/oberflaeche';

const SLOTS = 24;
const COLS = 6;

/** Tastenkennung normalisieren (1-Zeichen → Großbuchstabe, sonst e.key wie "F1"). */
function normalizeKey(e: KeyboardEvent | React.KeyboardEvent): string {
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

export function SoundboardView() {
  const boards = usePlayer((s) => s.playlists.filter((p) => p.kind === 'soundboard'));
  const soundboardId = usePlayer((s) => s.soundboardId);
  const cues = usePlayer((s) => s.cues);
  const selectSoundboard = usePlayer((s) => s.selectSoundboard);
  const createPlaylist = usePlayer((s) => s.createPlaylist);

  const [editSlot, setEditSlot] = useState<number | null>(null);
  // Stabiler Schließen-Rückruf: Modal meldet sich bei jedem neuen onClose neu an und holte den Fokus sonst bei jeder
  // Änderung der Padliste zurück auf das erste Feld.
  const schliessePad = useCallback(() => setEditSlot(null), []);

  const cueBySlot = useMemo(() => {
    const map = new Map<number, Cue>();
    for (const c of cues) map.set(c.slot, c);
    return map;
  }, [cues]);

  // Cue-Medien vordekodieren, sobald die Liste steht (latenzarmes Triggern).
  useEffect(() => {
    for (const c of cues) {
      if (c.media) void cueEngine.preload(c.media.id, window.jmplay.mediaUrl(c.media.path)).catch(() => {});
    }
  }, [cues]);

  const trigger = (cue: Cue): void => {
    if (cue.media) cueEngine.play(cue, window.jmplay.mediaUrl(cue.media.path));
  };

  // Globale Hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (istEingabeZiel(e.target)) return;
      const key = normalizeKey(e);
      const cue = cues.find((c) => c.hotkey && c.hotkey.toUpperCase() === key.toUpperCase());
      if (cue) {
        e.preventDefault();
        trigger(cue);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cues]);

  const newBoard = async (): Promise<void> => {
    const n = boards.length + 1;
    const pl = await createPlaylist(`Soundboard ${n}`, 'soundboard');
    if (pl) void selectSoundboard(pl.id);
  };

  if (boards.length === 0) {
    return (
      <div className="h-full grid place-items-center px-8">
        <div className="text-center max-w-sm">
          <h3 className="text-base font-extrabold">Noch kein Soundboard</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Lege ein Soundboard an und belege die Pads mit Sofort-Cues (z. B. Theatergong) auf Hotkeys.
          </p>
          <Button size="sm" variant="primary" className="mt-5" onClick={() => void newBoard()}>
            Soundboard anlegen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-[var(--border)]/60">
        <select
          value={soundboardId ?? ''}
          onChange={(e) => void selectSoundboard(Number(e.target.value))}
          className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold"
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => void newBoard()}>
          + Neu
        </Button>
        <div className="ml-auto">
          <Button size="sm" variant="ghost" onClick={() => cueEngine.stopAll()}>
            ■ Alle stoppen
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto scroll-thin p-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: SLOTS }, (_, slot) => (
            <Pad
              key={slot}
              slot={slot}
              cue={cueBySlot.get(slot) ?? null}
              onTrigger={trigger}
              onEdit={() => setEditSlot(slot)}
            />
          ))}
        </div>
      </div>

      {editSlot != null && soundboardId != null && (
        <CueEditor
          slot={editSlot}
          playlistId={soundboardId}
          cue={cueBySlot.get(editSlot) ?? null}
          onClose={schliessePad}
        />
      )}
    </div>
  );
}

function Pad({
  slot,
  cue,
  onTrigger,
  onEdit,
}: {
  slot: number;
  cue: Cue | null;
  onTrigger: (cue: Cue) => void;
  onEdit: () => void;
}) {
  const assigned = cue?.media != null;
  return (
    <div
      onClick={() => (assigned && cue ? onTrigger(cue) : onEdit())}
      className={cn(
        'group relative aspect-square rounded-[var(--radius-lg)] border p-3 flex flex-col cursor-pointer select-none transition-colors',
        assigned
          ? 'border-[var(--primary)]/40 bg-[var(--highlight)] hover:bg-[var(--primary)]/15 active:scale-[0.98]'
          : 'border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
      style={assigned && cue?.color ? { borderColor: cue.color } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted-foreground)]">
          {slot + 1}
        </span>
        <div className="flex items-center gap-1">
          {cue?.hotkey && (
            <span className="rounded bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-extrabold">
              {cue.hotkey}
            </span>
          )}
          <button
            type="button"
            title="Pad bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 grid place-items-center text-center">
        {assigned ? (
          <div className="px-1">
            <div className="text-sm font-bold leading-tight line-clamp-2">{cue?.label}</div>
            {cue?.media && (
              <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                {formatDuration(cue.media.durationSec)}
                {cue.loop ? ' · Loop' : ''}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs font-semibold">+ zuweisen</span>
        )}
      </div>
    </div>
  );
}

/** Dialog „Pad n belegen“ (Modal aus @jm/ui; exportiert für die Render-Tests). */
export function CueEditor({
  slot,
  playlistId,
  cue,
  onClose,
}: {
  slot: number;
  playlistId: number;
  cue: Cue | null;
  onClose: () => void;
}) {
  const items = usePlayer((s) => s.items);
  const assignCue = usePlayer((s) => s.assignCue);
  const clearCue = usePlayer((s) => s.clearCue);

  // Audio-Cues zuerst (Soundboard-typisch), Videos danach.
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'audio' ? -1 : 1;
      return a.fileName.localeCompare(b.fileName);
    });
  }, [items]);

  const [mediaId, setMediaId] = useState<number | null>(cue?.mediaId ?? sorted[0]?.id ?? null);
  const [label, setLabel] = useState(cue?.label ?? '');
  const [hotkey, setHotkey] = useState(cue?.hotkey ?? '');
  const [loop, setLoop] = useState(cue?.loop ?? false);

  const chosen = useMemo<MediaItem | null>(
    () => sorted.find((m) => m.id === mediaId) ?? null,
    [sorted, mediaId],
  );

  const save = async (): Promise<void> => {
    if (mediaId == null) return;
    await assignCue({
      playlistId,
      slot,
      mediaId,
      label: label.trim() || chosen?.fileName || `Cue ${slot + 1}`,
      hotkey: hotkey || null,
      loop,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose} className="w-full max-w-md">
      <h2 className="text-lg font-extrabold tracking-tight">Pad {slot + 1} belegen</h2>

      <div className="mt-5 flex flex-col gap-4">
        <Field label="Medium">
          <select
            value={mediaId ?? ''}
            onChange={(e) => setMediaId(Number(e.target.value))}
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-sm"
          >
            {sorted.length === 0 && <option value="">Bibliothek leer</option>}
            {sorted.map((m) => (
              <option key={m.id} value={m.id}>
                {m.kind === 'audio' ? '♪ ' : '▦ '}
                {m.fileName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Beschriftung">
          <input
            value={label}
            placeholder={chosen?.fileName ?? 'Cue-Name'}
            onChange={(e) => setLabel(e.target.value)}
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          />
        </Field>

        <div className="flex items-end gap-4">
          <Field label="Hotkey">
            <input
              value={hotkey}
              readOnly
              placeholder="Taste drücken…"
              onKeyDown={(e) => {
                e.preventDefault();
                if (e.key === 'Escape') return;
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  setHotkey('');
                  return;
                }
                setHotkey(normalizeKey(e));
              }}
              className="h-10 w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center font-extrabold cursor-pointer"
            />
          </Field>
          <label className="flex items-center gap-2 h-10 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Loop
          </label>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="ghost"
          uppercase={false}
          onClick={() => {
            void clearCue(slot);
            onClose();
          }}
        >
          Pad leeren
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button size="sm" variant="primary" disabled={mediaId == null} onClick={() => void save()}>
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
