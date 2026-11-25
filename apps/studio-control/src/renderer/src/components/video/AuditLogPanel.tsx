import { useApp } from '@/store/app';
import { Card } from '@jm/ui';
import { SectionHeader } from '@/components/ui/SectionHeader';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditLogPanel() {
  const audit = useApp((s) => s.audit);
  const recent = audit.slice(0, 12);

  return (
    <Card variant="nested" className="p-4">
      <SectionHeader>Letzte Aktionen</SectionHeader>
      {recent.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">Noch keine Aktionen.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1 text-xs select-text">
          {recent.map((entry) => (
            <li
              key={entry.id}
              className="grid grid-cols-[80px_120px_1fr_auto] gap-3 items-baseline tabular-nums"
            >
              <span className="text-[var(--muted-foreground)]">{formatTime(entry.ts)}</span>
              <span className="text-[var(--primary)]">{entry.username}</span>
              <span>{entry.action}</span>
              {entry.target && (
                <span className="text-[var(--muted-foreground)] truncate max-w-[120px]">
                  {entry.target}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
