import { cn } from '@jm/ui';
import { clipDurationUs, secToUs, usToSec, type Clip, type ScaleMode } from '@shared/project';
import { locateClip, useProject } from '@/store/project';
import { formatTimecode } from '@/lib/format';

export function Inspector() {
  const selectedClipId = useProject((s) => s.selectedClipId);
  const present = useProject((s) => s.present);
  const loc = locateClip(present, selectedClipId);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-l border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Eigenschaften
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {!loc && <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">Kein Clip ausgewählt.</p>}
        {loc && loc.clip.kind === 'media' && <MediaInspector clip={loc.clip} trackKind={loc.track.kind} />}
        {loc && loc.clip.kind === 'title' && <TitleInspector clip={loc.clip} />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full h-8 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-sm';

function MediaInspector({ clip, trackKind }: { clip: Clip; trackKind: string }) {
  const update = useProject((s) => s.updateClip);
  const present = useProject((s) => s.present);
  const asset = present.assets.find((a) => a.id === clip.assetId);
  const hasAudio = Boolean(asset?.hasAudio);
  const transSec = clip.transitionIn ? usToSec(clip.transitionIn.durationUs) : 0;

  return (
    <>
      <div className="text-xs font-semibold truncate">{asset?.fileName ?? 'Clip'}</div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
        <span>Quelle In: {formatTimecode(clip.inUs)}</span>
        <span>Quelle Out: {formatTimecode(clip.outUs)}</span>
        <span>Dauer: {formatTimecode(clipDurationUs(clip))}</span>
        <span>Start: {formatTimecode(clip.startUs)}</span>
      </div>

      <Row label="Startposition (s)">
        <input
          type="number"
          step={0.1}
          min={0}
          className={inputCls}
          value={usToSec(clip.startUs).toFixed(2)}
          onChange={(e) => update(clip.id, { startUs: Math.max(0, secToUs(Number(e.target.value))) }, 'Clip verschieben')}
        />
      </Row>

      {trackKind === 'video' && (
        <Row label="Einpassung">
          <select
            className={inputCls}
            value={clip.transform?.scaleMode ?? 'fit'}
            onChange={(e) =>
              update(clip.id, { transform: { scaleMode: e.target.value as ScaleMode } }, 'Einpassung ändern')
            }
          >
            <option value="fit">Einpassen (Letterbox)</option>
            <option value="fill">Füllen (Crop)</option>
            <option value="stretch">Verzerren</option>
          </select>
        </Row>
      )}

      {hasAudio && !clip.muteSource && (
        <Row label={`Lautstärke: ${Math.round((clip.gain ?? 1) * 100)}%`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            className="w-full"
            value={clip.gain ?? 1}
            onChange={(e) => update(clip.id, { gain: Number(e.target.value) }, 'Lautstärke ändern')}
          />
        </Row>
      )}

      <Row label={`Einblende (Kreuzblende): ${transSec.toFixed(1)} s`}>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          className="w-full"
          value={transSec}
          onChange={(e) => {
            const v = Number(e.target.value);
            update(
              clip.id,
              { transitionIn: v > 0 ? { kind: 'dissolve', durationUs: secToUs(v) } : undefined },
              'Übergang ändern',
            );
          }}
        />
      </Row>
    </>
  );
}

function TitleInspector({ clip }: { clip: Clip }) {
  const update = useProject((s) => s.updateClip);
  const title = clip.title!;
  const setTitle = (patch: Partial<typeof title>): void =>
    update(clip.id, { title: { ...title, ...patch } }, 'Titel ändern');
  const setStyle = (patch: Partial<typeof title.style>): void =>
    update(clip.id, { title: { ...title, style: { ...title.style, ...patch } } }, 'Titel ändern');

  return (
    <>
      <Row label="Titel">
        <input className={inputCls} value={title.text} onChange={(e) => setTitle({ text: e.target.value })} />
      </Row>
      <Row label="Untertitel">
        <input
          className={inputCls}
          value={title.subtitle ?? ''}
          onChange={(e) => setTitle({ subtitle: e.target.value })}
        />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label={`Schriftgröße: ${title.style.fontSize}`}>
          <input
            type="range"
            min={20}
            max={140}
            step={2}
            className="w-full"
            value={title.style.fontSize}
            onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
          />
        </Row>
        <Row label="Farbe">
          <input
            type="color"
            className="w-full h-8 rounded bg-transparent"
            value={title.style.color}
            onChange={(e) => setStyle({ color: e.target.value })}
          />
        </Row>
      </div>
      <Row label="Hintergrundbox">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(title.style.background)}
            onChange={(e) => setStyle({ background: e.target.checked ? '#000000cc' : null })}
          />
          <span className="text-xs text-[var(--muted-foreground)]">halbtransparent schwarz</span>
        </div>
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label={`X-Position: ${Math.round(title.style.x * 100)}%`}>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            className="w-full"
            value={title.style.x}
            onChange={(e) => setStyle({ x: Number(e.target.value) })}
          />
        </Row>
        <Row label={`Y-Position: ${Math.round(title.style.y * 100)}%`}>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            className="w-full"
            value={title.style.y}
            onChange={(e) => setStyle({ y: Number(e.target.value) })}
          />
        </Row>
      </div>
      <Row label="Fett">
        <input type="checkbox" checked={title.style.bold} onChange={(e) => setStyle({ bold: e.target.checked })} />
      </Row>
      <Row label={`Anzeigedauer: ${usToSec(clipDurationUs(clip)).toFixed(1)} s`}>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          className="w-full"
          value={usToSec(clipDurationUs(clip))}
          onChange={(e) => update(clip.id, { outUs: secToUs(Number(e.target.value)) }, 'Titeldauer ändern')}
        />
      </Row>
    </>
  );
}
