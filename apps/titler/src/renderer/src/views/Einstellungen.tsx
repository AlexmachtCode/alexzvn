// Inhalt des Einstellungs-Panels (UX-Pilot C9, C10; Spec 3.1, 3.6): vorerst der Inhalt des bisherigen Reiters
// „Einstellungen“, unverändert bis auf die Herkunft der Werte (Stand) und der Handler (Aktionen); dahinter seit C10 die
// tool-eigenen Abschnitte „Stil“ und „Grafik-Vorlagen“ (Anhang A, E13). Ab C11 bauen die Abschnitte aus @jm/settings das
// Panel neu. Kein window und kein Effekt hier (G7, G8): Das Panel ist nur offen gemountet; was immer laufen muss, bleibt
// in OperatorView.
import { Button, cn, PanelAnker, SettingsSection } from '@jm/ui';
import type { GraphicTemplate } from '@shared/types';
import { ABSCHNITT, TITLER_TEXTE, type OberflaechenStand, type TitlerAktionen } from '@/lib/oberflaeche';
import { ColorField, Field, Labeled, Slider } from './felder';

const RESOLUTIONS = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
];
const FPS = [25, 30, 50, 60];

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
  const { ndiActive, entries, dataError, datenQuelle } = stand.status;
  const displays = stand.displays ?? [];
  const { setConfig, pickFolder, startNdi, stopNdi } = aktionen;
  // iveo speist Speaker über die Datenquelle „Show“ ein (speakers.tsv in userData/iveo-data,
  // #11, Spec 7.7) — der Titler hält kein Token/Backend. `config.dataFolder` ist nur noch
  // der eigene Ordner des Bedieners und sagt darüber nichts mehr.
  const iveoActive = datenQuelle.art === 'show' || datenQuelle.art === 'master';
  // Ordnerwahl im Verbund gesperrt (Spec 17.2, Owner O1): Text statt Auswahl; der Main lehnt ebenfalls ab.
  const ordnerGesperrt = datenQuelle.ordnerGesperrt;

  return (
    <div className="space-y-5">
      {/* DataLink (#86): Datenquelle konfigurieren (Abruf in der Bedienung unter „Daten / Recall“). */}
      <SettingsSection
        title="DataLink"
        description={
          <>
            Platzhalter <code className="text-[var(--primary)]">{'{{name}}'}</code> in den Textfeldern
            werden aus den Dateien im Ordner gefüllt. CSV mit Kopfzeile = Liste (je Zeile ein Eintrag,
            im Reiter <b>Steuerung</b> abrufbar); <code>schlüssel=wert</code>-Datei = ein Eintrag.
          </>
        }
      >
        <div className="flex gap-2">
          <input
            value={c.dataFolder}
            onChange={(e) => void setConfig({ dataFolder: e.target.value })}
            placeholder="Kein Ordner gewählt"
            spellCheck={false}
            disabled={!!ordnerGesperrt}
            className="h-9 flex-1 min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs disabled:opacity-50"
          />
          <Button variant="outline" size="sm" onClick={() => void pickFolder()} disabled={!!ordnerGesperrt}>
            Durchsuchen…
          </Button>
          {c.dataFolder && !ordnerGesperrt ? (
            <Button variant="ghost" size="sm" uppercase={false} onClick={() => void setConfig({ dataFolder: '' })} title="Watchfolder entfernen">
              ✕
            </Button>
          ) : null}
        </div>
        {ordnerGesperrt ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">{ordnerGesperrt}</p>
        ) : null}
        {/* K1 (Spec 7.7/7.8): nur bei Quelle Show und einem eigenen Ordner, der nicht iveo-data ist */}
        {datenQuelle?.zurueckKnopf ? (
          <Button
            variant="outline"
            size="sm"
            uppercase={false}
            className="w-full"
            onClick={() => aktionen.zurueckZumEigenenOrdner()}
          >
            {datenQuelle.zurueckKnopf}
          </Button>
        ) : null}
        {dataError ? (
          <p className="text-[11px] text-[var(--destructive)]">DataLink: {dataError}</p>
        ) : null}
      </SettingsSection>

      {/* iveo (#11): Status der automatischen Speaker-Übernahme aus der JM Show. */}
      <SettingsSection title="iveo">
        {iveoActive ? (
          <div className="rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--primary)]">
                iveo aktiv
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {entries.length} Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach
              iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter <b>Steuerung › Daten / Recall</b>.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Kein iveo-Event aktiv. iveo-Speaker werden automatisch zu Bauchbinden-Variablen, sobald der
            Titler über eine <b>JM Show</b> mit iveo-Daten geöffnet wird — Verwaltung und Zugriffstoken
            bleiben im Launcher (der Titler speichert kein Token).
          </p>
        )}
      </SettingsSection>

      {/* Ausgabe (NDI) */}
      <SettingsSection title="Ausgabe (NDI)">
        <Field label="Quellname" value={c.ndiName} onChange={(v) => void setConfig({ ndiName: v })} />
        <div className="flex gap-2">
          <Labeled label="Auflösung">
            <select
              value={`${c.width}x${c.height}`}
              onChange={(e) => {
                const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
                if (r) void setConfig({ width: r.w, height: r.h });
              }}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.w}x${r.h}`}>
                  {r.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="fps">
            <select
              value={String(c.fps)}
              onChange={(e) => void setConfig({ fps: Number(e.target.value) })}
              className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold tabular"
            >
              {FPS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        {ndiActive ? (
          <Button variant="destructive" className="w-full" onClick={() => void stopNdi()}>
            NDI stoppen
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void startNdi(c.ndiName)}>
            NDI starten
          </Button>
        )}
        {c.width % 2 !== 0 || c.height % 2 !== 0 ? (
          <p className="text-[11px] text-[var(--destructive)]">Auflösung sollte gerade sein.</p>
        ) : null}
      </SettingsSection>

      {/* Ausgabe (2. Bildschirm, #161) */}
      <SettingsSection
        title="Ausgabe (2. Bildschirm)"
        description="Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI."
      >
        <Labeled label="Monitor">
          <select
            value={String(c.secondScreenDisplay)}
            onChange={(e) => void setConfig({ secondScreenDisplay: Number(e.target.value) })}
            className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm font-semibold"
          >
            <option value="0">Primär (automatisch)</option>
            {displays.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="flex gap-3 items-end">
          <ColorField label="Chroma" value={c.chromaColor} onChange={(v) => void setConfig({ chromaColor: v })} />
          <button
            onClick={() => void setConfig({ chromaColor: '#00B140' })}
            className="h-9 shrink-0 rounded-[var(--radius)] border border-[var(--border)] px-3 text-xs hover:bg-[var(--highlight)]"
            title="Standard-Green (#00B140) zurücksetzen"
          >
            Reset
          </button>
        </div>
        {c.secondScreenEnabled ? (
          <Button variant="destructive" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: false })}>
            2. Bildschirm ausschalten
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void setConfig({ secondScreenEnabled: true })}>
            2. Bildschirm einschalten
          </Button>
        )}
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.
        </p>
      </SettingsSection>

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
