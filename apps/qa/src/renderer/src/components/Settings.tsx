import { useState } from 'react';
import type { QaCloudInfo, QaConfig } from '@shared/types';
import { useQa } from '@/store/useQa';

const inp = 'rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-800/60 py-2.5">
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-neutral-500">{hint}</div>}
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
        className="w-[34rem] rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center">
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <button onClick={onClose} className="ml-auto rounded px-2 text-neutral-400 hover:bg-neutral-800">
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
 * Cloud-Relay. Proxy-URL/Key + Event + Presse-Code. Der Live-Status (QR/Links)
 * liegt im CloudPanel rechts. Externe Einreichungen sind IMMER moderationspflichtig.
 */
function CloudSettings({ config, cloud }: { config: QaConfig; cloud: QaCloudInfo }) {
  const { setCloudConfig, setProxyKey, cloudGenerateEvent } = useQa();
  const [key, setKey] = useState('');

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="mb-1 text-sm font-semibold text-neutral-300">Externe Einreichung (Stream & Presse)</div>
      <p className="mb-2 text-[11px] text-neutral-500">
        Fragen von außerhalb des Saal-WLANs — Ende-zu-Ende verschlüsselt über den Cloud-Relay. Presse per
        Zugangscode. Alle externen Einreichungen sind freigabepflichtig.
      </p>

      <Row label="Proxy-URL" hint="Basis-URL des Q&A-Relays (Cloudflare-Worker).">
        <input
          className={`${inp} w-56`}
          placeholder="https://…workers.dev"
          value={config.proxyUrl}
          onChange={(e) => void setCloudConfig({ proxyUrl: e.target.value })}
        />
      </Row>

      <Row label="Proxy-Key" hint={cloud.hasKey ? 'Hinterlegt (verschlüsselt gespeichert).' : 'Zugriffs-Key des Proxys (Secret).'}>
        <div className="flex gap-1">
          <input
            className={`${inp} w-40`}
            type="password"
            placeholder={cloud.hasKey ? '•••••• (ändern)' : 'Key'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            onClick={() => {
              void setProxyKey(key);
              setKey('');
            }}
          >
            Speichern
          </button>
        </div>
      </Row>

      <Row label="Event" hint={config.eventId ? `ID: ${config.eventId}` : 'Noch kein Event erzeugt.'}>
        <button
          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
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

      {cloud.lastError && <div className="mt-2 text-[11px] text-red-400">Fehler: {cloud.lastError}</div>}
    </div>
  );
}
