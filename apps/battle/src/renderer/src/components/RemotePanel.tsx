import { useEffect, useState } from 'react';
import { Button, Card } from '@jm/ui';
import type { BattleState } from '@shared/types';
import { BATTLE_TEXTE } from '@/lib/oberflaeche';
import { toDataUrl } from '@/lib/qr';

/** Was die Karte auslöst: der Handler `setRemote` des Stores. Das Voting der Runde öffnen und schließen ist jetzt eine Haupttaste. */
export interface RemoteAktionen {
  setRemote(an: boolean): void;
}

/** Publikums-Voting: QR + LAN-URLs und Server an/aus. Der QR bleibt schwarz auf weiß (lib/qr.ts), auch im hellen Modus. */
export function RemotePanel({ state, aktionen }: { state: BattleState; aktionen: RemoteAktionen }): React.JSX.Element {
  const [qr, setQr] = useState('');
  const url = state.remote.urls[0] ?? '';

  useEffect(() => {
    let cancelled = false;
    if (url) {
      void toDataUrl(url)
        .then((d) => !cancelled && setQr(d))
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Card glossy={false} data-ba="voting" className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{BATTLE_TEXTE.voting.titel}</h2>
        <Button
          type="button"
          size="sm"
          uppercase={false}
          variant={state.remote.running ? 'primary' : 'outline'}
          aria-pressed={state.remote.running}
          className="ml-auto"
          onClick={() => aktionen.setRemote(!state.remote.running)}
        >
          {state.remote.running ? '◉ An' : '○ Aus'}
        </Button>
      </div>

      {state.remote.running ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR zum Voting" className="rounded-lg bg-white p-1.5" width={170} height={170} />
          ) : (
            <div className="grid h-[170px] w-[170px] place-items-center rounded-lg bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
              {BATTLE_TEXTE.voting.keinNetzwerk}
            </div>
          )}
          <div className="w-full space-y-0.5">
            {state.remote.urls.map((u) => (
              <div key={u} className="truncate rounded bg-[var(--muted)] px-2 py-1 text-center text-[11px] text-[var(--foreground)]">
                {u}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">Aus. Anschalten, damit das Publikum per Handy (QR) für die Runden abstimmt.</p>
      )}
    </Card>
  );
}
