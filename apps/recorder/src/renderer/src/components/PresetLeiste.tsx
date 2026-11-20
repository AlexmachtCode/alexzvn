import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@jm/ui';
import { presetGeaendert, useRec } from '@/store/recorder';

type Modus = 'aus' | 'name' | 'ueberschreiben' | 'loeschen';

/** Preset-Leiste: Auswahl, Speichern, Löschen, Export/Import (#291). */
export function PresetLeiste() {
  const presets = useRec((s) => s.presets);
  const aktiv = useRec((s) => s.aktivesPreset);
  const geaendert = useRec((s) => presetGeaendert(s));
  const loading = useRec((s) => s.loading);
  const status = useRec((s) => s.state.status);
  const geplant = useRec((s) => s.state.scheduledStartAt);
  const anwenden = useRec((s) => s.presetAnwenden);
  const abwaehlen = useRec((s) => s.presetAbwaehlen);
  const speichern = useRec((s) => s.presetSpeichern);
  const loeschen = useRec((s) => s.presetLoeschen);
  const exportieren = useRec((s) => s.presetsExportieren);
  const importieren = useRec((s) => s.presetsImportieren);

  const [modus, setModus] = useState<Modus>('aus');
  const [name, setName] = useState('');
  // Lösch-Rückfrage gilt dem Preset, für das sie geöffnet wurde.
  const [loeschZiel, setLoeschZiel] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const gesperrt = loading || status === 'recording' || geplant != null;

  // Wechselt das aktive Preset während der Lösch-Rückfrage, schließt sie (kein Zustand ohne Knöpfe).
  useEffect(() => {
    if (modus === 'loeschen' && aktiv !== loeschZiel) setModus('aus');
  }, [modus, aktiv, loeschZiel]);

  // Menü schließt bei Klick daneben; Listener nur, solange es offen ist.
  useEffect(() => {
    if (!menu) return;
    const zu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', zu);
    return () => document.removeEventListener('mousedown', zu);
  }, [menu]);

  const schliessen = () => setModus('aus');

  const oeffneSpeichern = () => {
    setName(aktiv ?? '');
    setModus('name');
  };

  const speichernKlick = () => {
    const n = name.trim();
    if (!n) return;
    if (presets.some((p) => p.name === n)) {
      setModus('ueberschreiben');
      return;
    }
    void speichern(n);
    schliessen();
  };

  const ueberschreiben = () => {
    void speichern(name.trim());
    schliessen();
  };

  const wahl = (wert: string) => {
    if (wert === '') abwaehlen();
    else void anwenden(wert);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 min-w-[220px] flex-1 max-w-[360px]">
          <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            Preset
          </span>
          <select
            aria-label="Preset"
            value={aktiv ?? ''}
            disabled={gesperrt}
            onChange={(e) => wahl(e.target.value)}
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm disabled:opacity-50"
          >
            <option value="">— kein Preset —</option>
            {presets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name === aktiv && geaendert ? `${p.name} (geändert)` : p.name}
              </option>
            ))}
          </select>
        </label>

        {/* Die schon gewählte Option erneut wählen feuert kein `change` — daher ein eigener Knopf. */}
        {geaendert && !gesperrt && aktiv && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Preset neu anwenden – Änderungen verwerfen"
            onClick={() => void anwenden(aktiv)}
          >
            Zurücksetzen
          </Button>
        )}

        {modus === 'aus' && (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={oeffneSpeichern}>
              Als Preset speichern…
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!aktiv}
              onClick={() => {
                setLoeschZiel(aktiv);
                setModus('loeschen');
              }}
            >
              Löschen
            </Button>
            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                title="Weitere Preset-Aktionen"
                onClick={() => setMenu((m) => !m)}
              >
                ⋯
              </Button>
              {menu && (
                <div className="absolute right-0 top-full mt-1 z-10 min-w-[190px] flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                  <button
                    type="button"
                    disabled={presets.length === 0}
                    onClick={() => {
                      setMenu(false);
                      void exportieren();
                    }}
                    className="h-8 px-3 rounded-[var(--radius)] text-left text-sm hover:bg-[var(--highlight)] disabled:opacity-40"
                  >
                    Presets exportieren…
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      void importieren();
                    }}
                    className="h-8 px-3 rounded-[var(--radius)] text-left text-sm hover:bg-[var(--highlight)]"
                  >
                    Presets importieren…
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {modus === 'name' && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Name des Presets"
              aria-label="Preset-Name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') speichernKlick();
                else if (e.key === 'Escape') schliessen();
              }}
              className="h-10 w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
            <Button type="button" size="sm" variant="outline" disabled={!name.trim()} onClick={speichernKlick}>
              Speichern
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={schliessen}>
              Abbrechen
            </Button>
          </div>
        )}

        {modus === 'ueberschreiben' && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{`„${name.trim()}“ gibt es schon – überschreiben?`}</span>
            <Button type="button" size="sm" variant="outline" onClick={ueberschreiben}>
              Überschreiben
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={schliessen}>
              Abbrechen
            </Button>
          </div>
        )}

        {modus === 'loeschen' && loeschZiel && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{`Preset „${loeschZiel}“ löschen?`}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void loeschen(loeschZiel);
                schliessen();
              }}
            >
              Löschen
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={schliessen}>
              Abbrechen
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
