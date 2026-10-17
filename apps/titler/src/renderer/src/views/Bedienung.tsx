// Bedienung des Titlers neben dem Live-Bereich (UX-Pilot C10; Spec 5.1, Anhang A „Titler“; E12, E13, E21, E23): „Vorlage“
// und „Inhalt“ immer offen, „Grafik-Vorlagen“ (Kacheln zum Wählen) und „Daten / Recall“ als Collapsible mit den
// bisherigen persistId (gemerkt je Arbeitsplatz). Rein darstellend: Werte und Rückrufe über Props, kein window, keine
// Effekte (G7, G8). Import, Löschen und Stil liegen im Einstellungs-Panel.
import { useMemo } from 'react';
import { Button, cn, Collapsible, Field, SettingsSection, TextInput } from '@jm/ui';
import type { GraphicTemplate, PartialTitlerConfig, TemplateKind, TitlerConfig, TitlerStatus } from '@shared/types';
import { usedVars } from '@shared/vars';
import { zaehlerText } from '@/lib/datalink-anzeige';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Slider } from './felder';

const TEMPLATES: { key: TemplateKind; label: string }[] = [
  { key: 'lowerthird', label: 'Bauchbinde' },
  { key: 'banner', label: 'Banner' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'graphic', label: 'Grafik' },
];

export interface BedienungProps {
  config: TitlerConfig;
  status: TitlerStatus;
  templates: GraphicTemplate[];
  setConfig(patch: PartialTitlerConfig): void;
  onSelectTemplate(t: GraphicTemplate): void;
  onOpenBoard(): void;
  onRecall(key: string): void;
}

export function Bedienung(p: BedienungProps): React.JSX.Element {
  const c = p.config;
  const { variables, dataSources, dataError, entries, activeEntry, hinweis, datenQuelle } = p.status;
  const activeTemplate = p.templates.find((t) => t.id === c.activeGraphicId);

  // Vorhandene Variablen (klein geschrieben) + im Text referenzierte Schlüssel
  // für die Variablen-Sektion (Treffer/Fehler markieren).
  const lowerVars = useMemo(() => {
    const m: Record<string, true> = {};
    for (const k of Object.keys(variables)) m[k.toLowerCase()] = true;
    return m;
  }, [variables]);
  const referenced = useMemo(() => {
    const set = new Set<string>();
    for (const t of [c.name, c.subtitle, c.bannerText, c.tickerText]) {
      for (const k of usedVars(t)) set.add(k);
    }
    return [...set];
  }, [c.name, c.subtitle, c.bannerText, c.tickerText]);

  return (
    <div data-titler="bedienung" className="w-[400px] shrink-0 overflow-auto border-l border-[var(--border)]/60">
      <div className="space-y-5 p-5">
        <SettingsSection title="Vorlage">
          <div className="flex gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={c.template === t.key}
                onClick={() => p.setConfig({ template: t.key })}
                className={cn(
                  'flex-1 h-9 rounded-[var(--radius)] text-xs font-extrabold uppercase tracking-wide border',
                  c.template === t.key
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                    : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Inhalt — Namensfeld: immer sichtbar, nicht ausklappbar (#165); jeder Tastendruck geht wie bisher an setConfig */}
        <SettingsSection title="Inhalt">
          {c.template === 'lowerthird' && (
            <>
              <Field label="Name">
                <TextInput value={c.name} onChange={(v) => p.setConfig({ name: v })} />
              </Field>
              <Field label="Untertitel">
                <TextInput value={c.subtitle} onChange={(v) => p.setConfig({ subtitle: v })} />
              </Field>
            </>
          )}
          {c.template === 'banner' && (
            <Field label="Banner-Text">
              <TextInput value={c.bannerText} onChange={(v) => p.setConfig({ bannerText: v })} />
            </Field>
          )}
          {c.template === 'ticker' && (
            <>
              <Field label="Ticker-Text">
                <TextInput value={c.tickerText} onChange={(v) => p.setConfig({ tickerText: v })} />
              </Field>
              <Slider
                label="Ticker-Tempo"
                value={c.tickerSpeed}
                min={0.02}
                max={0.3}
                step={0.01}
                onChange={(v) => p.setConfig({ tickerSpeed: v })}
              />
            </>
          )}
          {c.template === 'graphic' &&
            (activeTemplate ? (
              activeTemplate.slots.length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">Diese Vorlage hat keine Textfelder (reines Standbild).</p>
              ) : (
                activeTemplate.slots.map((s) => (
                  <Field key={s.key} label={s.label}>
                    <TextInput
                      value={c.slotText[s.key] ?? s.defaultText}
                      onChange={(v) => p.setConfig({ slotText: { ...c.slotText, [s.key]: v } })}
                    />
                  </Field>
                ))
              )
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keineGrafik}</p>
            ))}
        </SettingsSection>

        {/* Grafik-Vorlagen (#162): wählen per Kachel; Import und Löschen unter Einstellungen › Grafik-Vorlagen (E13) */}
        <Collapsible title="Grafik-Vorlagen" persistId="titler.graphics" defaultOpen={false}>
          {p.templates.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {p.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === c.activeGraphicId}
                  onClick={() => p.onSelectTemplate(t)}
                  className={cn(
                    'relative overflow-hidden rounded-[var(--radius)] border text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                    t.id === c.activeGraphicId
                      ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                  )}
                  title={t.name}
                >
                  {t.thumbDataUrl ? (
                    <img src={t.thumbDataUrl} alt="" className="cg-checker w-full h-20 object-contain" />
                  ) : (
                    <div className="cg-checker w-full h-20" />
                  )}
                  <span className="block truncate px-2 py-1 text-[11px] font-semibold">{t.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keineVorlagen}</p>
          )}
        </Collapsible>

        {/* Daten / Recall (#86/#152): Live-Abruf der DataLink-Einträge; den Ordner wählt Einstellungen › DataLink. */}
        <Collapsible title="Daten / Recall" persistId="titler.recall" defaultOpen>
          {/* Quelle über der Liste (Q1–Q3) und stehender Hinweis (H1–H7), Spec 7.8 */}
          {datenQuelle?.zeile ? (
            <p className="truncate text-[11px] text-[var(--muted-foreground)]" title={datenQuelle.zeile}>
              {datenQuelle.zeile}
            </p>
          ) : null}
          {/* Warnfarbe Orange statt Gelb (Spec 4.2, E25) */}
          {hinweis ? (
            <p
              role="status"
              className="rounded-[var(--radius)] border border-[var(--status-warn)]/50 bg-[var(--status-warn)]/15 px-3 py-2 text-[11px] text-[var(--foreground)]"
            >
              {hinweis.text}
            </p>
          ) : null}
          {datenQuelle?.ohneOrdner ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">{TITLER_TEXTE.keinOrdner}</p>
          ) : (
            <>
              {/* Fehler oben; eine noch geltende Liste bleibt darunter abrufbar, wie im Board (E21) */}
              {dataError ? <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p> : null}
              {/* Abrufbare Einträge (Recall); ◀/▶ Eintrag stehen als Haupttasten im Live-Bereich (E12) */}
              {entries.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                      {zaehlerText(activeEntry, entries.length)}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        uppercase={false}
                        onClick={() => p.onOpenBoard()}
                        title="Recall-Button-Board in eigenem Fenster öffnen (#152)"
                      >
                        ⧉ Board
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                    {entries.map((e, i) => (
                      <button
                        key={e.key}
                        type="button"
                        aria-current={i === activeEntry ? 'true' : undefined}
                        onClick={() => p.onRecall(e.key)}
                        className={cn(
                          'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                          i === activeEntry
                            ? 'bg-[var(--primary)]/15 text-[var(--foreground)] font-bold'
                            : 'hover:bg-[var(--highlight)] text-[var(--muted-foreground)]',
                        )}
                      >
                        <span className="tabular text-[10px] w-5 shrink-0 text-[var(--muted-foreground)]">{i + 1}</span>
                        <span className="truncate">{e.label || '—'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Variablen des aktiven Eintrags */}
              {dataError ? null : (
                <div className="rounded-[var(--radius)] border border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
                  {Object.keys(variables).length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                      Keine Variablen gefunden. Lege im Ordner z. B. eine <code>gaeste.csv</code> mit Kopfzeile
                      <code>name,funktion</code> an — oder eine <code>daten.txt</code> mit <code>name=Dr. Schmidt</code>.
                    </p>
                  ) : (
                    Object.entries(variables).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2 px-3 py-1.5 text-xs">
                        <code className="font-bold text-[var(--primary)] shrink-0">{`{{${k}}}`}</code>
                        <span className="truncate text-[var(--muted-foreground)]">{v || '—'}</span>
                      </div>
                    ))
                  )}
                  {dataSources.length > 0 ? (
                    <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      Quelle: {dataSources.join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
          {referenced.length > 0 ? (
            <p className="text-[11px] text-[var(--muted-foreground)] flex flex-wrap items-baseline gap-x-1">
              <span>Im Text verwendet:</span>
              {referenced.map((k) => (
                <code
                  key={k}
                  className={cn(k.toLowerCase() in lowerVars ? 'text-[var(--primary)]' : 'text-[var(--destructive)]')}
                  title={k.toLowerCase() in lowerVars ? 'Variable vorhanden' : 'Variable nicht gefunden'}
                >
                  {`{{${k}}}`}
                </code>
              ))}
            </p>
          ) : null}
        </Collapsible>
      </div>
    </div>
  );
}
