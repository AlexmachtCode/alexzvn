// Einstellungs-Panel des Titlers (UX-Pilot C11; Spec 3.6, 5.1, 6, Anhang A „Titler“ › Einstellungen): die fünf
// gemeinsamen Abschnitte aus @jm/settings (iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink) mit den
// Props aus lib/oberflaeche.ts – dieselben Ableitungen wie die Statusleiste, also eine Wahrheit (Spec 6.1) –, dahinter
// die tool-eigenen Abschnitte „Stil“ und „Grafik-Vorlagen“ (E13). Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie
// das settingsSection des Statuseintrags, E20). Kein window und kein Effekt (G7, G8): Das Panel ist nur offen gemountet;
// Fernsteuerung, Show-Vorlagen-Import, reportState und Monitorliste bleiben in OperatorView.
import { DataLinkSection, IveoSection, NdiOutputSection, RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Button, cn, PanelAnker, SettingsSection } from '@jm/ui';
import type { GraphicTemplate } from '@shared/types';
import {
  ABSCHNITT,
  bildschirmAbschnitt,
  dataLinkAbschnitt,
  fernsteuerungAbschnitt,
  iveoAbschnitt,
  ndiAbschnitt,
  TITLER_TEXTE,
  type OberflaechenStand,
  type TitlerAktionen,
} from '@/lib/oberflaeche';
import { ColorField, Slider } from './felder';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: TitlerAktionen;
  templates: GraphicTemplate[];
  activeGraphicId: string;
  onPickImport(): void;
  onDropImport(e: React.DragEvent): void;
  onDeleteTemplate(t: GraphicTemplate): void;
}

export function Einstellungen({
  stand,
  aktionen,
  templates,
  activeGraphicId,
  onPickImport,
  onDropImport,
  onDeleteTemplate,
}: EinstellungenProps): React.JSX.Element {
  const c = stand.config;
  const { setConfig } = aktionen;

  return (
    <div className="space-y-5">
      <IveoSection {...iveoAbschnitt(stand)} />
      <NdiOutputSection {...ndiAbschnitt(stand, aktionen)} />
      <ScreenOutputSection {...bildschirmAbschnitt(stand, aktionen)} />
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <DataLinkSection {...dataLinkAbschnitt(stand, aktionen)} />

      {/* Stil (tool-eigen, Anhang A): Lage, Größe, Farben; bisher in der Bedienung unter „Stil“ */}
      <PanelAnker id={ABSCHNITT.stil}>
        <SettingsSection title={TITLER_TEXTE.stil}>
          <div className="flex gap-2">
            {(['bottom', 'top'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={c.position === p}
                onClick={() => void setConfig({ position: p })}
                className={cn(
                  'flex-1 h-9 rounded-[var(--radius)] text-xs font-bold border',
                  c.position === p
                    ? 'bg-[var(--accent)] text-[var(--foreground)] border-transparent'
                    : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                )}
              >
                {p === 'bottom' ? 'Unten' : 'Oben'}
              </button>
            ))}
          </div>
          <Slider label="Größe" value={c.scale} min={0.6} max={1.6} step={0.05} onChange={(v) => void setConfig({ scale: v })} />
          <div className="flex gap-3">
            <ColorField label="Balken" value={c.colors.bar} onChange={(v) => void setConfig({ colors: { bar: v } })} />
            <ColorField label="Text" value={c.colors.text} onChange={(v) => void setConfig({ colors: { text: v } })} />
            <ColorField label="Akzent" value={c.colors.accent} onChange={(v) => void setConfig({ colors: { accent: v } })} />
          </div>
        </SettingsSection>
      </PanelAnker>

      {/* Grafik-Vorlagen (#162, tool-eigen): Import aus jm Grafiktool / PSD; je Vorlage ein sichtbarer Knopf „Löschen“ (E13) */}
      <PanelAnker id={ABSCHNITT.vorlagen}>
        <SettingsSection
          title={TITLER_TEXTE.vorlagen}
          description={
            <>
              Bauchbinden aus dem jm Grafiktool oder als <code>.psd</code> importieren. Textebenen werden zu
              füllbaren Feldern — Variablen bleiben nutzbar.
            </>
          }
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropImport}
            className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-3 text-center"
          >
            <Button variant="outline" size="sm" onClick={() => onPickImport()}>
              Datei importieren…
            </Button>
            <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">oder .psd / .jmtitler hierher ziehen</p>
          </div>
          {templates.length > 0 ? (
            <ul className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={cn('truncate text-xs', t.id === activeGraphicId && 'font-bold')} title={t.name}>
                    {t.name}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    uppercase={false}
                    className="ml-auto shrink-0"
                    aria-label={TITLER_TEXTE.loeschenAria(t.name)}
                    title={TITLER_TEXTE.loeschenAria(t.name)}
                    onClick={() => onDeleteTemplate(t)}
                  >
                    {TITLER_TEXTE.loeschen}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
