// Werkzeugleiste von Studio-Control (UX Welle 2b, Studio-Control d1; B15, S3-A; Vorbild Player): links die Reiter Video · Audio ·
// Licht · Setup als Tabs aus @jm/ui, rechts „‹Benutzer› · ‹Rolle›“ und „Abmelden“. Der Kopf bleibt frei für ON AIR.
// Ohne Hooks und ohne Effekte: Abschnitt, Benutzer und die Rückrufe kommen aus der Wurzel-View. Die Reiter tragen nur ihre Namen;
// die alten Hinweise („TriCaster · PTZ · Kumo“, „Coming soon“, „Geräte · Benutzer“) entfallen (R9, Liste für Z1).
import { Button, Tabs, type TabItem } from '@jm/ui';
import { STUDIO_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import type { Section } from '@/store/app';

/** Die vier Reiter mit den Namen der alten Navigation (Topbar.tsx), Schlüssel = Abschnitt im Store. */
export const REITER: TabItem<Section>[] = [
  { key: 'video', label: 'Video' },
  { key: 'audio', label: 'Audio' },
  { key: 'licht', label: 'Licht' },
  { key: 'setup', label: 'Setup' },
];

export interface WerkzeugleisteProps {
  abschnitt: Section;
  onAbschnitt(abschnitt: Section): void;
  benutzer: NonNullable<OberflaechenStand['benutzer']>;
  onAbmelden(): void;
}

export function Werkzeugleiste({ abschnitt, onAbschnitt, benutzer, onAbmelden }: WerkzeugleisteProps): React.JSX.Element {
  return (
    <>
      <Tabs items={REITER} value={abschnitt} onChange={onAbschnitt} fill={false} />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {/* Wie bisher erst ab Breite md (Topbar.tsx); die Statusleiste nennt den Benutzer immer. */}
        <span data-studio="benutzer" className="hidden whitespace-nowrap text-xs text-[var(--muted-foreground)] md:inline">
          {benutzer.name}
          {STUDIO_TEXTE.trenner}
          {STUDIO_TEXTE.rolle[benutzer.rolle]}
        </span>
        <Button data-studio="abmelden" type="button" variant="outline" size="sm" onClick={onAbmelden}>
          {STUDIO_TEXTE.abmelden}
        </Button>
      </div>
    </>
  );
}
