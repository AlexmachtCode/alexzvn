import { useEffect, useState } from 'react';
import { Button } from '@jm/ui';
import { useQa } from '@/store/useQa';
import { toDataUrl } from '@/lib/qr';
import { QA_TEXTE } from '@/lib/oberflaeche';
import { TON } from '@/lib/zugang-ton';
import type { QaCloudInfo, QaConfig } from '@shared/types';

/** Was die Karte auslöst: die Handler des Stores (cloudEnable, cloudPurge, setCloudConfig), als Rückrufe ohne Rückgabe. */
export interface CloudAktionen {
  cloudEnable(enabled: boolean): void;
  cloudPurge(): void;
  setCloudConfig(patch: Partial<QaConfig>): void;
}

/**
 * Externe Einreichung (#166): An/Aus, QR für den Livestream-Stream-Link, Presse-
 * Link + Zugangscode, Kanal-Schalter und „Event beenden". Konfiguration (Server-
 * Adresse, Event erzeugen, Presse-Code) liegt im Panel-Abschnitt „Extern“. Die Zeile „Zugang“ sagt in jedem Zustand, was gilt
 * oder worauf Q&A wartet (Anmeldung im Launcher, Teil 1, P31; Q2–Q6, Q12); der An-Knopf hängt nicht am Key.
 */
export function CloudPanel({ cloud }: { cloud: QaCloudInfo }): React.JSX.Element {
  const { cloudEnable, cloudPurge, setCloudConfig } = useQa();
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (cloud.enabled && cloud.streamUrl) {
      void toDataUrl(cloud.streamUrl)
        .then((d) => !cancelled && setQr(d))
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [cloud.enabled, cloud.streamUrl]);

  return (
    <CloudAnsicht
      cloud={cloud}
      qr={qr}
      aktionen={{
        cloudEnable: (an) => void cloudEnable(an),
        cloudPurge: () => void cloudPurge(),
        setCloudConfig: (patch) => void setCloudConfig(patch),
      }}
    />
  );
}

/** Reine Darstellung der Karte (ohne Zustand und Effekt), damit die Rückfrage ohne Browser prüfbar ist. */
export function CloudAnsicht({ cloud, qr, aktionen }: { cloud: QaCloudInfo; qr: string; aktionen: CloudAktionen }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Extern (Stream & Presse)</h2>
        <Button
          type="button"
          variant={cloud.enabled ? 'accent' : 'outline'}
          size="sm"
          uppercase={false}
          className="ml-auto"
          onClick={() => aktionen.cloudEnable(!cloud.enabled)}
          disabled={!cloud.configured && !cloud.enabled}
        >
          {cloud.enabled ? '◉ An' : '○ Aus'}
        </Button>
      </div>

      {cloud.zugang.zeile ? <p className={`mb-2 text-[11px] ${TON[cloud.zugang.ton]}`}>{cloud.zugang.zeile}</p> : null}

      {!cloud.configured && !cloud.enabled ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Für Fragen per Livestream oder Presse: im Launcher anmelden und hier ein Event erzeugen.
        </p>
      ) : cloud.enabled ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR-Code für die Stream-Einreichung" className="rounded-lg bg-white p-1.5" width={180} height={180} />
          ) : (
            <div className="grid h-[180px] w-[180px] place-items-center rounded-[var(--radius-md)] bg-[var(--input)] text-xs text-[var(--muted-foreground)]">
              …
            </div>
          )}
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">
            QR im Livestream einblenden — Zuschauer reichen verschlüsselt ein.
          </p>

          <div className="w-full space-y-1">
            <LinkRow label="Stream" url={cloud.streamUrl} />
            {cloud.pressCode ? <LinkRow label="Presse" url={cloud.pressUrl} /> : null}
            {cloud.pressCode ? (
              <div className="rounded bg-[var(--input)] px-2 py-1 text-center text-[11px] text-[var(--foreground)]">
                Presse-Code: <span className="font-semibold text-[var(--warning)]">{cloud.pressCode}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-3 text-[11px]">
            <label className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={cloud.streamOpen}
                onChange={(e) => aktionen.setCloudConfig({ streamOpen: e.target.checked })}
              />
              Stream offen
            </label>
            <label className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={cloud.pressOpen}
                onChange={(e) => aktionen.setCloudConfig({ pressOpen: e.target.checked })}
              />
              Presse offen
            </label>
          </div>

          {cloud.lastError ? (
            <p className="text-center text-[11px] text-[var(--destructive)]">Fehler: {cloud.lastError}</p>
          ) : (
            <p className="text-center text-[11px] text-[var(--muted-foreground)]">
              {cloud.lastPollAt ? 'Verbunden — Einreichungen werden abgeholt.' : QA_TEXTE.extern.verbinde}
            </p>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            uppercase={false}
            className="mt-1"
            onClick={() => {
              if (confirm('Event beenden und alle externen Einreichungen im Relay löschen?')) aktionen.cloudPurge();
            }}
          >
            Event beenden & Daten löschen
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          Aus. Anschalten, damit Fragen per Livestream-QR und von der Presse eingehen.
        </p>
      )}
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 shrink-0 text-[10px] uppercase text-[var(--muted-foreground)]">{label}</span>
      <div className="min-w-0 flex-1 truncate rounded bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)]" title={url}>
        {url}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        uppercase={false}
        onClick={() => void navigator.clipboard?.writeText(url)}
        title="Link kopieren"
      >
        ⧉
      </Button>
    </div>
  );
}
