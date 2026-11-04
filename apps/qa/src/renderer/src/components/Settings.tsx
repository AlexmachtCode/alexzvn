import { useState } from 'react';
import type { QaCloudInfo, QaConfig } from '@shared/types';
import { useQa } from '@/store/useQa';

const inp = 'rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]';
/** Farbe der Zugangszeile je Ton (Anmeldung im Launcher, Teil 1, P31). */
const TON = { ok: 'text-[var(--muted-foreground)]', warn: 'text-[var(--warning)]', fehler: 'text-[var(--destructive)]' } as const;

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)]/60 py-2.5">
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-[var(--muted-foreground)]">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Einstellungen: Redezeit + Auto-Kopplung (Timer/Titler) + Moderation + Cloud. */
export function Settings({ config, cloud, onClose }: { config: QaConfig; cloud: QaCloudInfo; onClose: () => void }) {
  const { setConfig } = useQa();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 py-8" onClick={onClose}>
      <div
        className="w-[34rem] rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center">
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <button onClick={onClose} className="ml-auto rounded px-2 text-[var(--muted-foreground)] hover:bg-[var(--highlight)]">
            ✕
          </button>
        </div>

        <Row label="Redezeit (Sekunden)" hint="Setzt den JM Timer beim Ans-Wort-Holen.">
          <input
            type="number"
            min={5}
            max={3600}
            value={config.speakSeconds}
            onChange={(e) => void setConfig({ speakSeconds: Math.max(5, Number(e.target.value) || 0) })}
            className={`${inp} w-24`}
          />
        </Row>

        <Row label="Redezeit-Timer automatisch" hint="JM Timer setzen + starten, wenn jemand ans Wort kommt.">
          <input type="checkbox" checked={config.autoTimer} onChange={(e) => void setConfig({ autoTimer: e.target.checked })} />
        </Row>

        <Row
          label="Bauchbinde automatisch"
          hint="JM Titler beim Ans-Wort-Holen ein-/ausblenden. Name/Funktion werden mitgesendet — ein Titler mit text-Befehl übernimmt sie automatisch."
        >
          <input type="checkbox" checked={config.autoTitler} onChange={(e) => void setConfig({ autoTitler: e.target.checked })} />
        </Row>

        <Row label="Titler-Vorlage">
          <select
            value={config.titlerTemplate}
            onChange={(e) => void setConfig({ titlerTemplate: e.target.value as QaConfig['titlerTemplate'] })}
            className={inp}
          >
            <option value="lowerthird">Bauchbinde</option>
            <option value="banner">Banner</option>
            <option value="ticker">Ticker</option>
          </select>
        </Row>

        <Row label="Moderation" hint="Saal-Einreichungen müssen erst freigegeben werden, bevor sie aufgerufen werden.">
          <input type="checkbox" checked={config.moderation} onChange={(e) => void setConfig({ moderation: e.target.checked })} />
        </Row>

        <CloudSettings config={config} cloud={cloud} />
      </div>
    </div>
  );
}

/**
 * Externe Einreichung (#166): Fragen per Livestream-QR + Presse vorab, über den
 * Cloud-Relay. Server-Adresse (Vorgabe) + Event + Presse-Code; der Zugang kommt als Freigabe vom Launcher, der
 * alte Proxy-Key nur im Übergang (Anmeldung im Launcher, Teil 1, P31). Der Live-Status (QR/Links)
 * liegt im CloudPanel rechts. Externe Einreichungen sind IMMER moderationspflichtig.
 */
function CloudSettings({ config, cloud }: { config: QaConfig; cloud: QaCloudInfo }) {
  const { setCloudConfig, setProxyKey, cloudGenerateEvent } = useQa();
  const [key, setKey] = useState('');

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)]/40 p-3">
      <div className="mb-1 text-sm font-semibold text-[var(--foreground)]">Externe Einreichung (Stream & Presse)</div>
      <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
        Fragen von außerhalb des Saal-WLANs — Ende-zu-Ende verschlüsselt über den Cloud-Relay. Presse per
        Zugangscode. Alle externen Einreichungen sind freigabepflichtig.
      </p>

      <Row label="Server-Adresse" hint="Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.">
        <input
          className={`${inp} w-56`}
          placeholder={cloud.proxyUrl}
          value={config.proxyUrl}
          onChange={(e) => void setCloudConfig({ proxyUrl: e.target.value })}
        />
      </Row>

      {cloud.zugang.zeile ? <div className={`py-2 text-[11px] ${TON[cloud.zugang.ton]}`}>{cloud.zugang.zeile}</div> : null}

      {/* Alter Proxy-Key nur im Übergang (Spec 10, EP22): solange einer gespeichert ist oder keine Freigabe vorliegt. */}
      {cloud.hasKey || cloud.zugang.art !== 'freigabe' ? (
        <Row label="Alter Proxy-Key (Übergang)" hint="Nur noch kurz gültig. Mit Anmeldung im Launcher brauchst du ihn nicht.">
          <div className="flex gap-1">
            <input
              className={`${inp} w-40`}
              type="password"
              placeholder={cloud.hasKey ? '•••••• (ändern)' : 'Key'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
              onClick={() => {
                void setProxyKey(key);
                setKey('');
              }}
            >
              Speichern
            </button>
          </div>
        </Row>
      ) : cloud.zugang.hinweis ? (
        <div className="py-2 text-[11px] text-[var(--muted-foreground)]">{cloud.zugang.hinweis}</div>
      ) : null}

      <Row label="Event" hint={config.eventId ? `ID: ${config.eventId}` : 'Noch kein Event erzeugt.'}>
        <button
          className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
          onClick={() => void cloudGenerateEvent()}
        >
          {config.eventId ? 'Neues Event' : 'Event erzeugen'}
        </button>
      </Row>

      <Row label="Presse-Zugangscode" hint="Nur mit diesem Code kann Presse einreichen (leer = Presse-Kanal aus).">
        <input
          className={`${inp} w-40`}
          placeholder="z. B. PRESSE-2026"
          value={config.pressCode}
          onChange={(e) => void setCloudConfig({ pressCode: e.target.value })}
        />
      </Row>

      {cloud.lastError && <div className="mt-2 text-[11px] text-[var(--destructive)]">Fehler: {cloud.lastError}</div>}
    </div>
  );
}
