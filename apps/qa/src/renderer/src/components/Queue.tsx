import { useState } from 'react';
import type { QaChannel, QaConfig, QaEntry, QaSubmission } from '@shared/types';
import { useQa } from '@/store/useQa';

/** Herkunftskanal-Badge (#166) — Presse hervorgehoben (Moderations-Relevanz). */
function ChannelBadge({ channel }: { channel: QaChannel }) {
  if (channel === 'operator') return null;
  const map: Record<Exclude<QaChannel, 'operator'>, { label: string; cls: string }> = {
    lan: { label: 'Saal', cls: 'bg-[var(--input)] text-[var(--muted-foreground)]' },
    stream: { label: 'Stream', cls: 'bg-sky-600/25 text-sky-300' },
    press: { label: 'Presse', cls: 'bg-amber-500/25 text-amber-300' },
  };
  const b = map[channel];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${b.cls}`}>{b.label}</span>;
}

const inp = 'rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]';
const iconBtn = 'rounded px-1.5 py-0.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)]';

/** Warteliste (queuebar) + erledigte Einträge. */
export function Queue({ entries, config }: { entries: QaEntry[]; config: QaConfig }) {
  const waiting = entries.filter((e) => e.status === 'waiting');
  const done = entries.filter((e) => e.status === 'done');
  const { clearDone } = useQa();

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Warteschlange</h2>
          <span className="text-xs text-[var(--muted-foreground)]">{waiting.length}</span>
        </div>
        {waiting.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-4 text-center text-xs text-[var(--muted-foreground)]">
            Keine offenen Wortmeldungen.
          </div>
        ) : (
          <div className="space-y-1.5">
            {waiting.map((e, i) => (
              <WaitingRow key={e.id} entry={e} first={i === 0} last={i === waiting.length - 1} moderation={config.moderation} />
            ))}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">Erledigt</h2>
            <span className="text-xs text-[var(--muted-foreground)]">{done.length}</span>
            <button onClick={() => void clearDone()} className={`${iconBtn} ml-auto`}>
              Erledigte entfernen
            </button>
          </div>
          <div className="space-y-1">
            {done.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)]/60 px-3 py-1.5 text-sm text-[var(--muted-foreground)]">
                <span className="line-through">{e.name}</span>
                {e.affiliation && <span className="text-xs">· {e.affiliation}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WaitingRow({
  entry,
  first,
  last,
  moderation,
}: {
  entry: QaEntry;
  first: boolean;
  last: boolean;
  moderation: boolean;
}) {
  const { activate, removeEntry, moveEntry, approveEntry, updateEntry } = useQa();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<QaSubmission>({
    name: entry.name,
    affiliation: entry.affiliation,
    question: entry.question,
  });

  // Jede unbestätigte Remote-Einreichung wartet auf Freigabe — externe Kanäle
  // (Stream/Presse) sind immer freigabepflichtig, unabhängig vom Moderations-Schalter.
  const pending = entry.source === 'remote' && !entry.approved;
  void moderation;

  if (editing) {
    return (
      <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
        <input className={`${inp} w-full`} value={form.name} placeholder="Name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={`${inp} w-full`} value={form.affiliation} placeholder="Funktion / Medium" onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
        <textarea className={`${inp} w-full`} rows={2} value={form.question} placeholder="Frage (optional)" onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button className={iconBtn} onClick={() => setEditing(false)}>Abbrechen</button>
          <button
            className="rounded bg-[var(--brand-yellow)] px-2 py-0.5 text-xs font-semibold text-[var(--brand-dark)]"
            onClick={() => {
              void updateEntry(entry.id, form);
              setEditing(false);
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
        pending ? 'border-[var(--warning)]/60 bg-[var(--warning)]/10' : 'border-[var(--border)] bg-[var(--card)]/40'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{entry.name}</span>
          {entry.affiliation && <span className="truncate text-xs text-[var(--muted-foreground)]">· {entry.affiliation}</span>}
          <ChannelBadge channel={entry.channel} />
          {pending && <span className="rounded bg-[var(--warning)]/25 px-1.5 py-0.5 text-[10px] text-[var(--warning)]">wartet auf Freigabe</span>}
        </div>
        {entry.question && <div className="mt-0.5 text-sm text-[var(--muted-foreground)]">{entry.question}</div>}
        {entry.contact && <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Kontakt: {entry.contact}</div>}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button className={iconBtn} disabled={first} onClick={() => void moveEntry(entry.id, -1)} title="hoch">▲</button>
        <button className={iconBtn} disabled={last} onClick={() => void moveEntry(entry.id, 1)} title="runter">▼</button>
        <button className={iconBtn} onClick={() => setEditing(true)} title="bearbeiten">✎</button>
        <button className={iconBtn} onClick={() => void removeEntry(entry.id)} title="entfernen">✕</button>
        {pending && (
          <button
            className="ml-1 rounded bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--secondary-foreground)] hover:brightness-125"
            onClick={() => void approveEntry(entry.id, true)}
          >
            Freigeben
          </button>
        )}
        <button
          className="ml-1 rounded bg-[var(--brand-yellow)] px-2 py-1 text-xs font-semibold text-[var(--brand-dark)]"
          onClick={() => void activate(entry.id)}
          title="ans Wort holen (Bauchbinde + Redezeit)"
        >
          ▶ Ans Wort
        </button>
      </div>
    </div>
  );
}
