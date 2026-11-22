import { useState } from 'react';
import { Badge, Button, TextInput } from '@jm/ui';
import type { QaChannel, QaConfig, QaEntry, QaSubmission } from '@shared/types';
import { useQa } from '@/store/useQa';

/** Herkunftskanal-Badge (#166) — Presse hervorgehoben (Moderations-Relevanz). Farben nur aus dem Badge-Baustein (Tokens). */
function ChannelBadge({ channel }: { channel: QaChannel }): React.JSX.Element | null {
  if (channel === 'operator') return null;
  const map: Record<Exclude<QaChannel, 'operator'>, { label: string; tone: 'muted' | 'neutral' | 'warning' }> = {
    lan: { label: 'Saal', tone: 'muted' },
    stream: { label: 'Stream', tone: 'neutral' },
    press: { label: 'Presse', tone: 'warning' },
  };
  const b = map[channel];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

/** Warteliste (queuebar) + erledigte Einträge. */
export function Queue({ entries, config }: { entries: QaEntry[]; config: QaConfig }): React.JSX.Element {
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
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-4 text-center text-xs text-[var(--muted-foreground)]">
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
            <Button type="button" variant="ghost" size="sm" uppercase={false} className="ml-auto" onClick={() => void clearDone()}>
              Erledigte entfernen
            </Button>
          </div>
          <div className="space-y-1">
            {done.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)]">
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
}): React.JSX.Element {
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
      <div className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-2">
        <TextInput value={form.name} placeholder="Name" onChange={(name) => setForm({ ...form, name })} />
        <TextInput value={form.affiliation ?? ''} placeholder="Funktion / Medium" onChange={(affiliation) => setForm({ ...form, affiliation })} />
        <textarea
          className="w-full rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] px-2.5 py-1.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] select-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
          rows={2}
          value={form.question}
          placeholder="Frage (optional)"
          onChange={(e) => setForm({ ...form, question: e.target.value })}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" uppercase={false} onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            uppercase={false}
            onClick={() => {
              void updateEntry(entry.id, form);
              setEditing(false);
            }}
          >
            Speichern
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 ${
        pending ? 'border-[var(--warning)] bg-[var(--card)]' : 'border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="min-w-[10rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{entry.name}</span>
          {entry.affiliation && <span className="truncate text-xs text-[var(--muted-foreground)]">· {entry.affiliation}</span>}
          <ChannelBadge channel={entry.channel} />
          {pending && <Badge tone="warning">wartet auf Freigabe</Badge>}
        </div>
        {entry.question && <div className="mt-0.5 text-sm text-[var(--muted-foreground)]">{entry.question}</div>}
        {entry.contact && <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Kontakt: {entry.contact}</div>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button type="button" variant="ghost" size="sm" uppercase={false} disabled={first} onClick={() => void moveEntry(entry.id, -1)} title="hoch">
          ▲
        </Button>
        <Button type="button" variant="ghost" size="sm" uppercase={false} disabled={last} onClick={() => void moveEntry(entry.id, 1)} title="runter">
          ▼
        </Button>
        <Button type="button" variant="ghost" size="sm" uppercase={false} onClick={() => setEditing(true)} title="bearbeiten">
          ✎
        </Button>
        <Button type="button" variant="ghost" size="sm" uppercase={false} onClick={() => void removeEntry(entry.id)} title="entfernen">
          ✕
        </Button>
        {pending && (
          <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => void approveEntry(entry.id, true)}>
            Freigeben
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          uppercase={false}
          onClick={() => void activate(entry.id)}
          title="ans Wort holen (Bauchbinde + Redezeit)"
        >
          ▶ Ans Wort
        </Button>
      </div>
    </div>
  );
}
