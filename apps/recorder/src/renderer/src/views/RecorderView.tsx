// Arbeitsbereich des Recorders (UX Welle 2a, Recorder d; E13; Funktionsliste Nr. 31–37, 91–95): die Karte „Geplante Aufnahme“
// unter dem Live-Bereich. Bis Welle 2a stand hier die ganze Aufnahme-Ansicht; Seitenkopf, Eingang, Transport, Ziel und Pegel
// liegen jetzt im Live-Bereich (views/LiveBereich.tsx) und im Panel (views/Einstellungen.tsx).
// Bedienung wie bisher: dieselben Felder, Texte (der Fußtext nach R9, siehe RECORDER_TEXTE.zeitplan.fusstext), Sperren und
// Store-Aktionen; Startzeit und Dauer bleiben native Felder mit ihren Tasten (Nr. 118, 121). Neu ist nur die Quelle von offen,
// Aufnahme und Plan: der gemessene Zustand des Hauptprozesses (`zustand` aus der View), nicht der Vorgabewert des Stores.
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, TextInput } from '@jm/ui';
import type { RecorderState } from '@shared/types';
import { formatClock } from '@/lib/format';
import { RECORDER_TEXTE } from '@/lib/oberflaeche';
import { useRec } from '@/store/recorder';

/** Die Store-Aktionen der Karte, unter ihrem Namen im Store. */
export interface ZeitplanAktionen {
  setScheduleStart(s: string): void;
  setScheduleDurationMin(n: number): void;
  schedule(): void;
  cancelSchedule(): void;
}

/** Zeitgesteuerte Aufnahme am Store: Startzeit planen + Auto-Stopp nach Dauer; der Restzähler tickt, solange etwas ansteht. */
export function ScheduleCard({ zustand }: { zustand: RecorderState | undefined }): React.JSX.Element {
  const scheduleStart = useRec((s) => s.scheduleStart);
  const scheduleDurationMin = useRec((s) => s.scheduleDurationMin);
  const setScheduleStart = useRec((s) => s.setScheduleStart);
  const setScheduleDurationMin = useRec((s) => s.setScheduleDurationMin);
  const schedule = useRec((s) => s.schedule);
  const cancelSchedule = useRec((s) => s.cancelSchedule);

  const pendingStart = zustand?.scheduledStartAt != null;
  const pendingStop = zustand?.scheduledStopAt != null;

  // Takt 500 ms, solange etwas ansteht, damit die Countdowns laufen (wie bisher).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pendingStart && !pendingStop) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [pendingStart, pendingStop]);

  return (
    <ZeitplanKarte
      zustand={zustand}
      jetzt={now}
      werte={{ scheduleStart, scheduleDurationMin }}
      aktionen={{ setScheduleStart, setScheduleDurationMin, schedule: () => void schedule(), cancelSchedule: () => void cancelSchedule() }}
    />
  );
}

/** Die Karte ohne Store und ohne Hooks (für Tests und ScheduleCard). */
export function ZeitplanKarte({
  zustand,
  jetzt,
  werte,
  aktionen,
}: {
  zustand: RecorderState | undefined;
  jetzt: number;
  werte: { scheduleStart: string; scheduleDurationMin: number };
  aktionen: ZeitplanAktionen;
}): React.JSX.Element {
  const open = zustand !== undefined && zustand.status !== 'idle';
  const recording = zustand?.status === 'recording';
  const startAt = zustand?.scheduledStartAt;
  const stopAt = zustand?.scheduledStopAt;
  const startIn = startAt != null ? Math.max(0, Math.round((startAt - jetzt) / 1000)) : 0;
  const stopIn = stopAt != null ? Math.max(0, Math.round((stopAt - jetzt) / 1000)) : 0;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Geplante Aufnahme</h2>
        {startAt != null && <Badge tone="warning">Start in {formatClock(startIn)}</Badge>}
        {startAt == null && recording && stopAt != null && <Badge tone="warning">Auto-Stopp in {formatClock(stopIn)}</Badge>}
      </div>

      {!open ? (
        <p className="text-sm text-[var(--muted-foreground)]">Erst den Eingang öffnen — dann lässt sich Start- und Stoppzeit planen.</p>
      ) : startAt != null ? (
        <div className="flex items-center gap-4">
          <span className="text-sm">
            Geplant für <span className="tabular font-semibold">{new Date(startAt).toLocaleString()}</span>
            {stopAt != null && (
              <>
                {' '}· Stopp <span className="tabular font-semibold">{new Date(stopAt).toLocaleTimeString()}</span>
              </>
            )}
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={aktionen.cancelSchedule}>
            Abbrechen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_auto_auto]">
          <Field label="Startzeit (leer = sofort)">
            <TextInput type="datetime-local" value={werte.scheduleStart} disabled={recording} onChange={aktionen.setScheduleStart} />
          </Field>
          <Field label="Dauer (Min, 0 = manuell)">
            <div className="w-28">
              <TextInput type="number" min={0} step={1} value={String(werte.scheduleDurationMin)} disabled={recording} onChange={(v) => aktionen.setScheduleDurationMin(Number(v))} className="tabular" />
            </div>
          </Field>
          <Button variant="primary" disabled={recording} onClick={aktionen.schedule}>
            Planen
          </Button>
        </div>
      )}

      <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">{RECORDER_TEXTE.zeitplan.fusstext}</p>
    </Card>
  );
}
