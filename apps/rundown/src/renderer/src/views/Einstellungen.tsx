// Einstellungs-Panel des Rundowns (UX Welle 1, Aufgabe d; Spec 3.6, 5.1, 6, Anhang A „Rundown“; E11, E12): iveo (nur Anzeige),
// Fernsteuerung (nur Status) und die Gegenstellen aus @jm/settings; PeersSection ersetzt das Modal ConnectionsPanel. Alle Props
// kommen aus lib/oberflaeche.ts – dieselbe Ableitung wie die Statusleiste, also eine Wahrheit (Spec 6.1). Die Abschnitte sind die
// Sprungziele der Statuseinträge (PanelAnker steckt in SectionFrame). Kein window und kein Effekt (G7, G8): Setzen und Auto sind
// Rückrufe der View.
import { IveoSection, PeersSection, RemoteControlSection } from '@jm/settings';
import { fernsteuerungAbschnitt, gefundeneAdressen, gegenstellenAbschnitt, iveoAbschnitt, RUNDOWN_TEXTE, type OberflaechenStand, type RundownAktionen } from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: RundownAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      <IveoSection {...iveoAbschnitt(stand)} />
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <div className="space-y-2">
        <PeersSection {...gegenstellenAbschnitt(stand, aktionen)} />
        {/* Was PeersSection nicht zeigt (E11, Nachbesserung): der Leertext der alten Statusleiste und die Adresse eines mDNS-Fundes. */}
        {stand.state.links.length === 0 ? (
          <p data-rundown="keine-tools" className="text-[11px] text-[var(--muted-foreground)]">
            {RUNDOWN_TEXTE.gegenstellen.keine}
          </p>
        ) : (
          gefundeneAdressen(stand).map((g) => (
            <p key={g.role} data-rundown="gefunden" className="text-[11px] text-[var(--muted-foreground)]">
              {g.label} · {g.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
