// Einstellungs-Panel von Battle (UX Welle 1, Aufgabe d; Spec 3.6, 5.1, 6, Anhang A „Battle“; E16): die Fernsteuerung (nur Status) und die
// Gegenstellen aus @jm/settings (PeersSection ersetzt das Modal ConnectionsPanel) mit den Props aus lib/oberflaeche.ts – dieselbe
// Ableitung wie die Statusleiste, also eine Wahrheit (Spec 6.1) –, dahinter die tool-eigenen Abschnitte „Battle“ (Runden, Publikums-Voting,
// VS automatisch), „Instant-Replay“ (Zielordner) und „Zurücksetzen“ (mit Rückfrage). Das alte Einstellungs-Modal entfällt. Jeder Abschnitt
// ist ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Effekt, kein Store (G7, G8): Alles
// Auslösende sind Rückrufe der View. Die Abschnitte sind Funktionen, keine Komponenten, damit der Baum ohne Browser prüfbar ist.
import { PeersSection, RemoteControlSection } from '@jm/settings';
import { Button, Field, NumberInput, PanelAnker, SettingsSection, Toggle, useFeld } from '@jm/ui';
import {
  ABSCHNITT,
  BATTLE_TEXTE,
  clipZielText,
  fernsteuerungAbschnitt,
  gefundeneAdressen,
  gegenstellenAbschnitt,
  type BattleAktionen,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import type { BattleConfig } from '@shared/types';

/** Alles, was das Panel auslöst: die Handler des Stores, als Rückrufe ohne Rückgabe. */
export interface EinstellungenAktionen extends BattleAktionen {
  setConfig(patch: Partial<BattleConfig>): void;
  pickClipDir(): void;
  reset(): void;
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <div className="space-y-2">
        <PeersSection {...gegenstellenAbschnitt(stand, aktionen)} />
        {/* Was PeersSection nicht zeigt: der erste Satz des alten Erklärtexts im Modal und die Adresse eines mDNS-Fundes. */}
        <p data-ba="gegenstellen-erklaerung" className="text-[11px] text-[var(--muted-foreground)]">
          {BATTLE_TEXTE.gegenstellen.erklaerung}
        </p>
        {gefundeneAdressen(stand).map((g) => (
          <p key={g.role} data-ba="gefunden" className="text-[11px] text-[var(--muted-foreground)]">
            {g.label} · {g.text}
          </p>
        ))}
      </div>
      {battleAbschnitt(stand, aktionen)}
      {replayAbschnitt(stand, aktionen)}
      {zuruecksetzenAbschnitt(aktionen)}
    </div>
  );
}

/** Battle: Runden, Publikums-Voting erlaubt, VS-Bauchbinde automatisch (Texte wörtlich wie im alten Modal). */
function battleAbschnitt({ state }: OberflaechenStand, aktionen: EinstellungenAktionen): React.JSX.Element {
  const config = state.config;
  return (
    <PanelAnker id={ABSCHNITT.battle}>
      <SettingsSection title={BATTLE_TEXTE.titel.battle}>
        <div className="space-y-3">
          <Field label="Runden" hint="Anzahl der Battle-Runden.">
            {/* Wie das alte Feld: zwischen 1 und 20 geklemmt, die Zahl wirkt im Handler (0 → 1, 99 → 20). */}
            <NumberInput value={config.rounds} onChange={(v) => aktionen.setConfig({ rounds: Math.max(1, Math.min(20, v)) })} />
          </Field>
          <Field label="Publikums-Voting" hint="Abstimmung per QR/Handy zulassen.">
            <Toggle checked={config.votingEnabled} onChange={(an) => aktionen.setConfig({ votingEnabled: an })} />
          </Field>
          <Field label="VS-Bauchbinde automatisch" hint="JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).">
            <Toggle checked={config.autoTitler} onChange={(an) => aktionen.setConfig({ autoTitler: an })} />
          </Field>
        </div>
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

/** Instant-Replay: der Zielordner der Clips (Quelle und Länge stehen am Clip-Knopf im Live-Bereich). */
function replayAbschnitt({ state }: OberflaechenStand, aktionen: EinstellungenAktionen): React.JSX.Element {
  return (
    <PanelAnker id={ABSCHNITT.replay}>
      <SettingsSection title={BATTLE_TEXTE.titel.replay}>
        <Field label={BATTLE_TEXTE.replay.zielLabel}>
          <div className="flex items-center gap-2">
            <FeldKnopf onClick={() => aktionen.pickClipDir()}>Zielordner …</FeldKnopf>
            <span data-ba="clip-ziel" className="min-w-0 truncate text-xs text-[var(--muted-foreground)]" title={state.config.clipDir}>
              {clipZielText(state.config)}
            </span>
          </div>
        </Field>
      </SettingsSection>
    </PanelAnker>
  );
}

/** Zurücksetzen (E16): leert Runden und Stimmen, die Namen bleiben; ein laufendes VS geht aus. Mit Rückfrage wie bisher. */
function zuruecksetzenAbschnitt(aktionen: EinstellungenAktionen): React.JSX.Element {
  return (
    <PanelAnker id={ABSCHNITT.zuruecksetzen}>
      <SettingsSection title={BATTLE_TEXTE.titel.zuruecksetzen}>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          uppercase={false}
          onClick={() => {
            if (confirm(BATTLE_TEXTE.zuruecksetzen.frage)) aktionen.reset();
          }}
        >
          {BATTLE_TEXTE.zuruecksetzen.knopf}
        </Button>
      </SettingsSection>
    </PanelAnker>
  );
}
