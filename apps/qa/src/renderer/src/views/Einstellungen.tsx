// Einstellungs-Panel von Q&A (UX Welle 1, Aufgabe d; Spec 3.6, 5.1, 6, Anhang A „Q&A“; E13, E14): die Fernsteuerung (nur Status) und
// die Gegenstellen aus @jm/settings (PeersSection ersetzt das Modal ConnectionsPanel) mit den Props aus lib/oberflaeche.ts – dieselbe
// Ableitung wie die Statusleiste, also eine Wahrheit (Spec 6.1) –, dahinter die tool-eigenen Abschnitte „Redezeit und Kopplung“,
// „Moderation“ und „Extern“ (Inhalt des alten Einstellungs-Overlays, das Overlay entfällt). Jeder Abschnitt ist ein Sprungziel
// (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Effekt, kein Store (G7, G8): Alles Auslösende sind
// Rückrufe der View. Die Abschnitte sind Funktionen, keine Komponenten, damit der Baum ohne Browser prüfbar ist; nur das Key-Feld
// hat lokalen Zustand (der eingetippte Key, nie gespeichert).
//
// Extern (E14): Die Texte stehen wörtlich wie im alten Overlay (Q1, Q6a, Q6b, Q12 und die übrigen); sie sind nicht in QA_TEXTE, weil
// sie schon freigegeben und nicht neu sind. Die Quelltext-Wächter dazu stehen in test/cloud-zugang.test.ts.
import { useState } from 'react';
import { PeersSection, RemoteControlSection } from '@jm/settings';
import { Button, Field, PanelAnker, Select, SettingsSection, TextInput, Toggle, useFeld } from '@jm/ui';
import { GeklemmteZahl } from '@/components/GeklemmteZahl';
import {
  ABSCHNITT,
  fernsteuerungAbschnitt,
  gefundeneAdressen,
  gegenstellenAbschnitt,
  QA_TEXTE,
  type OberflaechenStand,
  type QaAktionen,
} from '@/lib/oberflaeche';
import { TON } from '@/lib/zugang-ton';
import type { QaConfig } from '@shared/types';

/** Alles, was das Panel auslöst: die Handler des Stores, als Rückrufe ohne Rückgabe. */
export interface EinstellungenAktionen extends QaAktionen {
  setConfig(patch: Partial<QaConfig>): void;
  setCloudConfig(patch: Partial<QaConfig>): void;
  setProxyKey(key: string): void;
  cloudGenerateEvent(): void;
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
}

const VORLAGEN = [
  { value: 'lowerthird', label: 'Bauchbinde' },
  { value: 'banner', label: 'Banner' },
  { value: 'ticker', label: 'Ticker' },
] as const;

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <div className="space-y-2">
        <PeersSection {...gegenstellenAbschnitt(stand, aktionen)} />
        {/* Was PeersSection nicht zeigt: der erste Satz des alten Erklärtexts im Modal und die Adresse eines mDNS-Fundes. */}
        <p data-qa="gegenstellen-erklaerung" className="text-[11px] text-[var(--muted-foreground)]">
          {QA_TEXTE.gegenstellen.erklaerung}
        </p>
        {gefundeneAdressen(stand).map((g) => (
          <p key={g.role} data-qa="gefunden" className="text-[11px] text-[var(--muted-foreground)]">
            {g.label} · {g.text}
          </p>
        ))}
      </div>
      {redezeitAbschnitt(stand, aktionen)}
      {moderationAbschnitt(stand, aktionen)}
      {externAbschnitt(stand, aktionen)}
    </div>
  );
}

/** Redezeit und Kopplung (E13): Redezeit, Auto-Timer, Auto-Bauchbinde, Titler-Vorlage; die einzigen Schalter der Kopplungen. */
function redezeitAbschnitt({ state }: OberflaechenStand, aktionen: EinstellungenAktionen): React.JSX.Element {
  const config = state.config;
  return (
    <PanelAnker id={ABSCHNITT.redezeit}>
      <SettingsSection title={QA_TEXTE.titel.redezeit} description={QA_TEXTE.kopplung.erklaerung}>
        <div className="space-y-3">
          <Field label="Redezeit (Sekunden)" hint="Setzt den JM Timer beim Ans-Wort-Holen.">
            {/* R21: wie das alte Feld ohne Unter- und Obergrenze im Feld: Das Feld nimmt jede Zahl, der Klemmwert wirkt beim Übernehmen
                (3 → 5, 4000 bleibt 4000). GeklemmteZahl zeigt danach den echten Wert, auch wenn er schon am Klemmwert stand (C4). */}
            <GeklemmteZahl value={config.speakSeconds} klemme={(v) => Math.max(5, v)} onChange={(v) => aktionen.setConfig({ speakSeconds: v })} />
          </Field>
          <Field label="Redezeit-Timer automatisch" hint="JM Timer setzen + starten, wenn jemand ans Wort kommt.">
            <Toggle checked={config.autoTimer} onChange={(an) => aktionen.setConfig({ autoTimer: an })} />
          </Field>
          <Field
            label="Bauchbinde automatisch"
            hint="JM Titler beim Ans-Wort-Holen ein-/ausblenden. Name/Funktion werden mitgesendet — ein Titler mit text-Befehl übernimmt sie automatisch."
          >
            <Toggle checked={config.autoTitler} onChange={(an) => aktionen.setConfig({ autoTitler: an })} />
          </Field>
          <Field label="Titler-Vorlage">
            <Select
              options={VORLAGEN}
              value={config.titlerTemplate}
              onChange={(v) => aktionen.setConfig({ titlerTemplate: v as QaConfig['titlerTemplate'] })}
            />
          </Field>
        </div>
      </SettingsSection>
    </PanelAnker>
  );
}

function moderationAbschnitt({ state }: OberflaechenStand, aktionen: EinstellungenAktionen): React.JSX.Element {
  return (
    <PanelAnker id={ABSCHNITT.moderation}>
      <SettingsSection title={QA_TEXTE.titel.moderation}>
        <Field label="Moderation" hint="Saal-Einreichungen müssen erst freigegeben werden, bevor sie aufgerufen werden.">
          <Toggle checked={state.config.moderation} onChange={(an) => aktionen.setConfig({ moderation: an })} />
        </Field>
      </SettingsSection>
    </PanelAnker>
  );
}

/** Ein Knopf in einem Field: bekommt dessen id und Hilfe, damit die Beschriftung (for=) und die Hilfe auf ihn zeigen. */
function FeldKnopf({ children, onClick }: { children: string; onClick(): void }): React.JSX.Element {
  const feld = useFeld();
  return (
    <Button type="button" variant="outline" size="sm" uppercase={false} id={feld?.ids.input} aria-describedby={feld?.describedBy} onClick={onClick}>
      {children}
    </Button>
  );
}

/**
 * Externe Einreichung (#166, E14): Fragen per Livestream-QR + Presse vorab, über den Cloud-Relay. Server-Adresse (Vorgabe) + Event +
 * Presse-Code; der Zugang kommt als Freigabe vom Launcher, der alte Proxy-Key nur im Übergang (Anmeldung im Launcher, Teil 1, P31).
 * Der Live-Status (QR/Links) liegt im CloudPanel im Live-Bereich. Externe Einreichungen sind IMMER moderationspflichtig.
 */
function externAbschnitt({ state }: OberflaechenStand, aktionen: EinstellungenAktionen): React.JSX.Element {
  const config = state.config;
  const cloud = state.cloud;
  return (
    <PanelAnker id={ABSCHNITT.extern}>
      <SettingsSection
        title={QA_TEXTE.extern.titel}
        description="Fragen von außerhalb des Saal-WLANs — Ende-zu-Ende verschlüsselt über den Cloud-Relay. Presse per Zugangscode. Alle externen Einreichungen sind freigabepflichtig."
      >
        <div className="space-y-3">
          <Field label="Server-Adresse" hint="Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.">
            <TextInput placeholder={cloud.proxyUrl} value={config.proxyUrl} onChange={(v) => aktionen.setCloudConfig({ proxyUrl: v })} />
          </Field>

          {cloud.zugang.zeile ? <div className={`text-[11px] ${TON[cloud.zugang.ton]}`}>{cloud.zugang.zeile}</div> : null}

          {/* Alter Proxy-Key nur im Übergang (Spec 10, EP22): solange einer gespeichert ist oder keine Freigabe vorliegt. */}
          {cloud.hasKey || cloud.zugang.art !== 'freigabe' ? (
            <AlterKey cloud={cloud} aktionen={aktionen} />
          ) : cloud.zugang.hinweis ? (
            <div className="text-[11px] text-[var(--muted-foreground)]">{cloud.zugang.hinweis}</div>
          ) : null}

          <Field label="Event" hint={config.eventId ? `ID: ${config.eventId}` : 'Noch kein Event erzeugt.'}>
            <FeldKnopf onClick={() => aktionen.cloudGenerateEvent()}>{config.eventId ? 'Neues Event' : 'Event erzeugen'}</FeldKnopf>
          </Field>

          <Field label="Presse-Zugangscode" hint="Nur mit diesem Code kann Presse einreichen (leer = Presse-Kanal aus).">
            <TextInput placeholder="z. B. PRESSE-2026" value={config.pressCode} onChange={(v) => aktionen.setCloudConfig({ pressCode: v })} />
          </Field>

          {cloud.lastError && <div className="text-[11px] text-[var(--destructive)]">Fehler: {cloud.lastError}</div>}
        </div>
      </SettingsSection>
    </PanelAnker>
  );
}

/** Der alte Proxy-Key: Passwortfeld und „Speichern“; der eingetippte Key lebt nur hier und wird nach dem Speichern geleert. */
function AlterKey({ cloud, aktionen }: { cloud: OberflaechenStand['state']['cloud']; aktionen: EinstellungenAktionen }): React.JSX.Element {
  const [key, setKey] = useState('');
  return (
    <Field label="Alter Proxy-Key (Übergang)" hint="Nur noch kurz gültig. Mit Anmeldung im Launcher brauchst du ihn nicht.">
      <div className="flex gap-2">
        <TextInput type="password" placeholder={cloud.hasKey ? '•••••• (ändern)' : 'Key'} value={key} onChange={setKey} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          uppercase={false}
          onClick={() => {
            aktionen.setProxyKey(key);
            setKey('');
          }}
        >
          Speichern
        </Button>
      </div>
    </Field>
  );
}
