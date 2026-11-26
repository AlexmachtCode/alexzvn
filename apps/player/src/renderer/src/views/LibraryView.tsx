import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, cn } from '@jm/ui';
import type { MediaItem } from '@shared/types';
import { usePlayer } from '@/store/player';
import { basename, formatBytes, formatDuration } from '@/lib/format';
import { entfernenOderFragen, mediumEntfernenFrage, type EntfernenRueckfrage } from '@/lib/oberflaeche';
import { EntfernenFrage } from './EntfernenFrage';
import { Fussleiste } from './Fussleiste';

/**
 * Entfernen eines Mediums aus der Bibliothek (Altfehler PL-10, Ruling R16), hooklos prüfbar: Benutzen Cues oder Pads das Medium
 * (`nutzung`), öffnet es die Rückfrage im Fenster (`fragen`) und entfernt erst mit deren „Entfernen“; sonst entfernt es wie bisher
 * sofort.
 */
export async function mediumEntfernen(a: {
  item: MediaItem;
  nutzung(id: number): Promise<{ cues: number; pads: number }>;
  entferne(id: number): unknown;
  fragen(r: EntfernenRueckfrage): void;
}): Promise<void> {
  const frage = mediumEntfernenFrage(a.item.title || a.item.fileName, await a.nutzung(a.item.id));
  entfernenOderFragen(frage, () => void a.entferne(a.item.id), a.fragen);
}

export function LibraryView() {
  const loading = usePlayer((s) => s.loading);
  const activePlaylistId = usePlayer((s) => s.activePlaylistId);

  // Fußleiste mit Stop und Panik (W2-10) fest unten, auch vor dem Laden; Quellen, Liste und Vorschau darüber.
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <section className="flex-1 min-w-0 flex flex-col border-r border-[var(--border)]/60">
          {loading ? (
            <div className="flex-1 grid place-items-center text-sm text-[var(--muted-foreground)]">
              Lade Bibliothek…
            </div>
          ) : activePlaylistId == null ? (
            <AllMediaList />
          ) : (
            <PlaylistQueue />
          )}
        </section>
        <PlayerPanel />
      </div>
      <Fussleiste />
    </div>
  );
}

// ---------------------------------------------------------------- Sidebar

function Sidebar() {
  const playlists = usePlayer((s) => s.playlists.filter((p) => p.kind === 'playlist'));
  const activePlaylistId = usePlayer((s) => s.activePlaylistId);
  const selectPlaylist = usePlayer((s) => s.selectPlaylist);
  const createPlaylist = usePlayer((s) => s.createPlaylist);
  const removePlaylist = usePlayer((s) => s.removePlaylist);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = async (): Promise<void> => {
    const pl = await createPlaylist(name, 'playlist');
    setName('');
    setAdding(false);
    if (pl) void selectPlaylist(pl.id);
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border)]/60 bg-[var(--card)]/30">
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
        Quellen
      </div>
      <nav className="px-2 flex-1 overflow-auto scroll-thin">
        <SourceRow active={activePlaylistId == null} onClick={() => selectPlaylist(null)} label="Alle Medien" />
        {playlists.map((p) => (
          <SourceRow
            key={p.id}
            active={activePlaylistId === p.id}
            onClick={() => selectPlaylist(p.id)}
            label={p.name}
            onRemove={() => removePlaylist(p.id)}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--border)]/60">
        {adding ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={name}
              placeholder="Playlist-Name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void submit();
                if (e.key === 'Escape') setAdding(false);
              }}
              className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!name.trim()} onClick={() => void submit()}>
                Anlegen
              </Button>
              <Button size="sm" variant="ghost" uppercase={false} onClick={() => setAdding(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding(true)}>
            + Playlist
          </Button>
        )}
      </div>
    </aside>
  );
}

function SourceRow({
  active,
  onClick,
  label,
  onRemove,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-9 px-2.5 rounded-[var(--radius)] cursor-pointer text-sm font-semibold',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/80 hover:bg-[var(--highlight)]',
      )}
      onClick={onClick}
    >
      <span className="truncate flex-1">{label}</span>
      {onRemove && (
        <button
          type="button"
          title="Playlist löschen"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------- All-media list

function AllMediaList() {
  const items = usePlayer((s) => s.items);
  const busy = usePlayer((s) => s.busy);
  const importFiles = usePlayer((s) => s.importFiles);
  const importFolders = usePlayer((s) => s.importFolders);
  const importPaths = usePlayer((s) => s.importPaths);
  const [query, setQuery] = useState('');
  // Altfehler PL-10, Ruling R16: die Rückfrage beim Entfernen eines benutzten Mediums ist ein Fenster im Fenster. Sie steht hier und
  // nicht in der Zeile, damit kein Klick und kein Doppelklick in ihr die Zeile erreicht (Doppelklick spielt das Medium).
  const [rueckfrage, setRueckfrage] = useState<EntfernenRueckfrage | null>(null);
  const schliesseRueckfrage = useCallback(() => setRueckfrage(null), []);

  const visible = useMemo(() => filterItems(items, query), [items, query]);

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.jmplay.pathForFile(f))
      .filter(Boolean);
    if (paths.length) void importPaths(paths);
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <ListHeader title="Alle Medien" count={visible.length} query={query} onQuery={setQuery}>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void importFolders()}>
          Ordner…
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void importFiles()}>
          Dateien…
        </Button>
      </ListHeader>

      {items.length === 0 ? (
        <EmptyImport onFolders={importFolders} onFiles={importFiles} busy={busy} />
      ) : (
        <div className="flex-1 overflow-auto scroll-thin px-3 pb-4">
          {visible.map((item) => (
            <MediaRow key={item.id} item={item} context="all" onFrage={setRueckfrage} />
          ))}
        </div>
      )}
      {rueckfrage && <EntfernenFrage rueckfrage={rueckfrage} onSchliessen={schliesseRueckfrage} />}
    </div>
  );
}

// ----------------------------------------------------------- Playlist queue

function PlaylistQueue() {
  const activePlaylistId = usePlayer((s) => s.activePlaylistId)!;
  const playlist = usePlayer((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const queue = usePlayer((s) => s.queue);
  const play = usePlayer((s) => s.play);
  const removeQueueItem = usePlayer((s) => s.removeQueueItem);
  const reorder = usePlayer((s) => s.queue);
  const [query, setQuery] = useState('');

  const move = (index: number, dir: -1 | 1): void => {
    const ids = queue.map((q) => q.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void window.jmplay.playlists.reorder(activePlaylistId, ids).then(() =>
      usePlayer.getState().selectPlaylist(activePlaylistId),
    );
  };

  const visible = useMemo(
    () => queue.filter((q) => matches(q.media, query)),
    [queue, query],
  );
  void reorder;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ListHeader title={playlist?.name ?? 'Playlist'} count={queue.length} query={query} onQuery={setQuery}>
        <Button
          size="sm"
          variant="primary"
          disabled={queue.length === 0}
          onClick={() => queue[0] && play(queue[0].media.id)}
        >
          ▶ Abspielen
        </Button>
      </ListHeader>

      {queue.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center px-8">
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
            Diese Playlist ist leer. Wechsle zu „Alle Medien" und füge Titel über das{' '}
            <span className="font-bold text-[var(--foreground)]">+</span> hinzu.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scroll-thin px-3 pb-4">
          {visible.map((q, i) => (
            <MediaRow
              key={q.id}
              item={q.media}
              context="playlist"
              onRemove={() => removeQueueItem(q.id)}
              onMove={(dir) => move(i, dir)}
              first={i === 0}
              last={i === visible.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ListHeader

function ListHeader({
  title,
  count,
  query,
  onQuery,
  children,
}: {
  title: string;
  count: number;
  query: string;
  onQuery: (q: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-[var(--border)]/60">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight truncate">{title}</h2>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{count} Titel</p>
      </div>
      <input
        value={query}
        placeholder="Suchen…"
        onChange={(e) => onQuery(e.target.value)}
        className="h-9 w-44 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm
                   focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
      />
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- MediaRow

function MediaRow({
  item,
  context,
  onRemove,
  onMove,
  onFrage,
  first,
  last,
}: {
  item: MediaItem;
  context: 'all' | 'playlist';
  onRemove?: () => void;
  onMove?: (dir: -1 | 1) => void;
  /** Öffnet die Rückfrage beim Entfernen aus der Bibliothek (nur „Alle Medien“, Ruling R16). */
  onFrage?: (r: EntfernenRueckfrage) => void;
  first?: boolean;
  last?: boolean;
}) {
  const currentMediaId = usePlayer((s) => s.currentMediaId);
  const play = usePlayer((s) => s.play);
  const removeItem = usePlayer((s) => s.removeItem);
  // Altfehler PL-10: Benutzen Cues oder Pads das Medium, fragt das Entfernen nach (mit Anzahl); sonst wie bisher ohne Rückfrage.
  // Ruling R16: gefragt wird im Fenster (EntfernenFrage in der Liste), ohne Rückfrage-Ziel entfernt nichts.
  const entferneMedium = (): Promise<void> =>
    mediumEntfernen({ item, nutzung: (id) => window.jmplay.library.nutzung(id), entferne: removeItem, fragen: (r) => onFrage?.(r) });
  const active = currentMediaId === item.id;

  return (
    <div
      onDoubleClick={() => play(item.id)}
      className={cn(
        'group flex items-center gap-3 px-2.5 py-2 rounded-[var(--radius)] cursor-default',
        active ? 'bg-[var(--primary)]/12' : 'hover:bg-[var(--highlight)]',
      )}
    >
      <button
        type="button"
        onClick={() => play(item.id)}
        title="Abspielen"
        className={cn(
          'grid place-items-center size-9 shrink-0 rounded-[var(--radius)] border',
          active
            ? 'border-[var(--primary)]/50 text-[var(--primary)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)]',
        )}
      >
        <PlayIcon />
      </button>

      <Thumb item={item} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{item.title || item.fileName}</div>
        <div className="truncate text-[11px] text-[var(--muted-foreground)]">
          {item.artist ? `${item.artist} · ` : ''}
          {item.codec ?? '—'} · {formatBytes(item.sizeBytes)}
        </div>
      </div>

      <Badge tone={item.kind === 'video' ? 'neutral' : 'muted'}>{item.kind}</Badge>
      <span className="tabular text-xs text-[var(--muted-foreground)] w-14 text-right">
        {formatDuration(item.durationSec)}
      </span>

      <div className="flex items-center gap-1 w-[120px] justify-end">
        {context === 'all' && <AddToPlaylist mediaId={item.id} />}
        {context === 'playlist' && onMove && (
          <>
            <IconBtn title="Hoch" disabled={first} onClick={() => onMove(-1)}>
              <ArrowIcon up />
            </IconBtn>
            <IconBtn title="Runter" disabled={last} onClick={() => onMove(1)}>
              <ArrowIcon />
            </IconBtn>
          </>
        )}
        <IconBtn title="Im Ordner zeigen" onClick={() => window.jmplay.shell.reveal(item.path)}>
          <FolderIcon />
        </IconBtn>
        {context === 'all' ? (
          <IconBtn title="Aus Bibliothek entfernen" onClick={() => void entferneMedium()}>
            <XIcon />
          </IconBtn>
        ) : (
          onRemove && (
            <IconBtn title="Aus Playlist entfernen" onClick={onRemove}>
              <XIcon />
            </IconBtn>
          )
        )}
      </div>
    </div>
  );
}

function AddToPlaylist({ mediaId }: { mediaId: number }) {
  const playlists = usePlayer((s) => s.playlists.filter((p) => p.kind === 'playlist'));
  const addToPlaylist = usePlayer((s) => s.addToPlaylist);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <IconBtn title="Zu Playlist hinzufügen" onClick={() => setOpen((v) => !v)}>
        <PlusIcon />
      </IconBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-xl py-1">
            {playlists.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                Erst eine Playlist anlegen.
              </div>
            ) : (
              playlists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void addToPlaylist(p.id, [mediaId]);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--highlight)] truncate"
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Thumb

function Thumb({ item }: { item: MediaItem }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (item.kind !== 'video') return;
    void window.jmplay.library.thumb(item.id).then((p) => {
      if (alive && p) setSrc(window.jmplay.mediaUrl(p));
    });
    return () => {
      alive = false;
    };
  }, [item.id, item.kind]);

  return (
    <div className="size-9 shrink-0 rounded-[var(--radius)] overflow-hidden bg-[var(--muted)] grid place-items-center">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[var(--muted-foreground)]">
          {item.kind === 'video' ? <FilmIcon /> : <NoteIcon />}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- PlayerPanel

function PlayerPanel() {
  const items = usePlayer((s) => s.items);
  const currentMediaId = usePlayer((s) => s.currentMediaId);
  const playNext = usePlayer((s) => s.playNext);
  const playPrev = usePlayer((s) => s.playPrev);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const item = useMemo(() => items.find((m) => m.id === currentMediaId) ?? null, [items, currentMediaId]);
  const src = item ? window.jmplay.mediaUrl(item.path) : '';

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Transport bei Titelwechsel zurücksetzen.
  useEffect(() => {
    setTime(0);
    setDuration(0);
    setPlaying(false);
  }, [item?.id]);

  // Lautstärke/Mute am (neu gemounteten) Element nachziehen.
  useEffect(() => {
    const el = mediaRef.current;
    if (el) {
      el.volume = volume;
      el.muted = muted;
    }
  }, [volume, muted, item?.id]);

  const setRef = useCallback((el: HTMLMediaElement | null) => {
    mediaRef.current = el;
  }, []);

  const toggle = (): void => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const seek = (v: number): void => {
    const el = mediaRef.current;
    if (el) {
      el.currentTime = v;
      setTime(v);
    }
  };

  const seekPct = duration > 0 ? (time / duration) * 100 : 0;
  const volPct = (muted ? 0 : volume) * 100;
  const fill = (p: number): string =>
    `linear-gradient(to right, var(--primary) ${p}%, var(--muted) ${p}%)`;

  const mediaEvents = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: () => setTime(mediaRef.current?.currentTime ?? 0),
    onLoadedMetadata: () => setDuration(mediaRef.current?.duration || 0),
    onEnded: () => {
      // Repeat-One: denselben Clip neu starten; sonst regulär weiter (Shuffle/
      // Repeat-All steckt in playNext).
      if (repeat === 'one') {
        const el = mediaRef.current;
        if (el) {
          el.currentTime = 0;
          void el.play();
          return;
        }
      }
      playNext();
    },
  };

  return (
    <aside className="w-[440px] shrink-0 flex flex-col bg-[var(--card)]/30">
      {/* Medienfläche füllt die verfügbare Höhe */}
      <div className="flex-1 min-h-0 bg-black grid place-items-center overflow-hidden p-2">
        {!item ? (
          <span className="text-sm text-[var(--muted-foreground)]">Kein Titel gewählt</span>
        ) : item.kind === 'video' ? (
          <video key={item.id} ref={setRef} src={src} autoPlay className="max-h-full max-w-full" {...mediaEvents} />
        ) : (
          <div className="flex flex-col items-center gap-4 text-[var(--muted-foreground)]">
            <span className={playing ? 'text-[var(--primary)]' : ''}>
              <NoteIcon size={64} />
            </span>
            <span className="text-xs uppercase tracking-[0.2em] font-bold">Audio</span>
            <audio key={item.id} ref={setRef} src={src} autoPlay className="hidden" {...mediaEvents} />
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[var(--border)]/60 flex flex-col gap-5">
        <div>
          <div className="text-lg font-extrabold truncate leading-snug">
            {item ? item.title || item.fileName : '—'}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] truncate mt-1">
            {item ? basename(item.path) : 'Doppelklick auf einen Titel zum Abspielen'}
          </div>
        </div>

        {/* Seek */}
        <div className="flex items-center gap-3">
          <span className="tabular text-xs text-[var(--muted-foreground)] w-12 text-right">
            {formatDuration(time)}
          </span>
          <input
            type="range"
            className="jm-range flex-1"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            disabled={!item}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ background: fill(seekPct) }}
          />
          <span className="tabular text-xs text-[var(--muted-foreground)] w-12">
            {duration ? formatDuration(duration) : '–'}
          </span>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-3">
          <TransportBtn
            title={shuffle ? 'Zufallswiedergabe aus' : 'Zufallswiedergabe'}
            active={shuffle}
            onClick={toggleShuffle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 3h5v5" />
              <path d="M4 20 21 3" />
              <path d="M21 16v5h-5" />
              <path d="m15 15 6 6" />
              <path d="M4 4l5 5" />
            </svg>
          </TransportBtn>

          <TransportBtn title="Vorheriger" disabled={!item} onClick={() => playPrev()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 6h2v12H6zM20 6v12L9 12z" />
            </svg>
          </TransportBtn>

          <button
            type="button"
            title={playing ? 'Pause' : 'Abspielen'}
            disabled={!item}
            onClick={toggle}
            className={cn(
              'grid place-items-center size-16 rounded-full transition-opacity',
              'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {playing ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <TransportBtn title="Nächster" disabled={!item} onClick={() => playNext()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16 6h2v12h-2zM4 6l11 6L4 18z" />
            </svg>
          </TransportBtn>

          <TransportBtn
            title={
              repeat === 'one'
                ? 'Wiederholen: Einzelclip'
                : repeat === 'all'
                  ? 'Wiederholen: ganze Liste'
                  : 'Wiederholen: aus'
            }
            active={repeat !== 'none'}
            onClick={cycleRepeat}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
              {repeat === 'one' && <path d="M11 10h1v4" />}
            </svg>
          </TransportBtn>

          <div className="ml-auto flex items-center gap-2">
            <TransportBtn title={muted ? 'Ton an' : 'Stumm'} onClick={() => setMuted((m) => !m)}>
              {muted || volume === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" />
                </svg>
              )}
            </TransportBtn>
            <input
              type="range"
              className="jm-range w-28"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setMuted(false);
              }}
              style={{ background: fill(volPct) }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function TransportBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid place-items-center size-12 rounded-[var(--radius)] border transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'border-[var(--primary)]/60 bg-[var(--highlight)] text-[var(--primary)]'
          : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- helpers + icons

function filterItems(items: MediaItem[], query: string): MediaItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((m) => matches(m, q));
}
function matches(m: MediaItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.fileName.toLowerCase().includes(q) ||
    (m.title ?? '').toLowerCase().includes(q) ||
    (m.artist ?? '').toLowerCase().includes(q)
  );
}

function EmptyImport({
  onFolders,
  onFiles,
  busy,
}: {
  onFolders: () => void;
  onFiles: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex-1 grid place-items-center px-8">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 grid place-items-center size-14 rounded-[var(--radius-lg)] border border-[var(--border)] text-[var(--muted-foreground)]">
          <NoteIcon large />
        </div>
        <h3 className="text-base font-extrabold">Bibliothek ist leer</h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Ziehe Dateien hierher oder importiere einen Ordner mit Musik/Videos.
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <Button size="sm" variant="outline" disabled={busy} onClick={onFolders}>
            Ordner…
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={onFiles}>
            Dateien…
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="grid place-items-center size-8 rounded-[var(--radius)] text-[var(--muted-foreground)]
                 hover:bg-[var(--card)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function ArrowIcon({ up }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={up ? undefined : { transform: 'rotate(180deg)' }}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function FilmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
    </svg>
  );
}
function NoteIcon({ large, size }: { large?: boolean; size?: number }) {
  const s = size ?? (large ? 22 : 16);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
