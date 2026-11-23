import { Button, TallyButton } from '@jm/ui';
import { useProject } from '@/store/project';
import { NdiKnopf } from '@/components/NdiSchalter';
import { editorTaste, PRESENTER_TEXTE, type OberflaechenStand, type StartWahl } from '@/lib/oberflaeche';
import { NDI_STATUS_AUS, startZielFuer } from '../../../shared/ndi';

export interface WerkzeugleisteProps {
  /** Aus dem einen Stand der Wurzel-View (useStand): Präsentation, NDI und Plattform. */
  stand: Pick<OberflaechenStand, 'praesentation' | 'ndi' | 'plattform'>;
  /** Dieselbe Startwahl wie für Panel und Statusleiste (B11). */
  startWahl: StartWahl;
  /** NDI-Schalter: die Aktion der Wurzel-View (standAktionen). */
  onNdi(an: boolean): void;
}

/**
 * Werkzeugleiste des Editors (UX Welle 2b, d1; B14): links die sechs Datei-Knöpfe, rechts busy.label, der NDI-Schalter und die
 * Haupttaste „Präsentieren“/„Beenden“ in fester Breite. Ohne eigenen Kopf (der kommt aus AppShell) und ohne ⚙-Menü (dessen
 * Inhalt steht im Panel). Keine Abos: Präsentation und NDI kommen aus dem Stand, der Rest aus dem Store. Bei schmalem Fenster
 * bricht die rechte Gruppe in eine zweite Zeile um, statt aus dem Fenster zu laufen; die Leiste wächst mit.
 */
export function Werkzeugleiste({ stand, startWahl, onNdi }: WerkzeugleisteProps) {
  const doc = useProject((s) => s.doc);
  const busy = useProject((s) => s.busy);
  const dirty = useProject((s) => s.dirty);
  const selectedId = useProject((s) => s.selectedId);
  const importDocs = useProject((s) => s.importDocs);
  const importOffice = useProject((s) => s.importOffice);
  const newProject = useProject((s) => s.newProject);
  const openProject = useProject((s) => s.openProject);
  const saveProject = useProject((s) => s.saveProject);
  const exportPdf = useProject((s) => s.exportPdf);
  const buildPayload = useProject((s) => s.buildPayload);
  const setError = useProject((s) => s.setError);

  const visibleCount = doc.slides.filter((s) => !s.hidden).length;
  const taste = editorTaste(stand, visibleCount, busy);

  const startPresentation = async (): Promise<void> => {
    if (visibleCount === 0) {
      setError(PRESENTER_TEXTE.grund.keineFolien);
      return;
    }
    const visible = doc.slides.filter((s) => !s.hidden);
    const startIndex = Math.max(
      0,
      visible.findIndex((s) => s.id === selectedId),
    );
    const payload = buildPayload(startIndex);
    await window.jmpr.present.start(payload, startZielFuer(startWahl.nurNdi, stand.ndi ?? NDI_STATUS_AUS, startWahl.bildschirm));
  };

  // Frisch beginnen, ohne die App zu schließen (Issue #40): leert das Projekt,
  // danach führt der Empty-State direkt zum Import der neuen PDF. Bei
  // ungespeicherten Änderungen erst rückfragen, damit nichts verloren geht.
  const handleNew = (): void => {
    if (
      dirty &&
      doc.slides.length > 0 &&
      !window.confirm(
        'Aktuelle Präsentation verwerfen und neu beginnen? Nicht gespeicherte Änderungen gehen verloren.',
      )
    ) {
      return;
    }
    newProject();
  };

  const datei = (text: string, onClick: () => void, gesperrt = busy.active) => (
    <Button type="button" size="sm" variant="outline" uppercase={false} disabled={gesperrt} onClick={onClick}>
      {text}
    </Button>
  );

  return (
    <div data-presenter="werkzeugleiste" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {datei('Neu', handleNew)}
        {datei('+ PDF / Bilder', () => void importDocs())}
        {datei('+ Office', () => void importOffice())}
        {datei('Öffnen', () => void openProject())}
        {datei(`Speichern${dirty ? ' •' : ''}`, () => void saveProject())}
        {datei('PDF-Export', () => void exportPdf(), busy.active || visibleCount === 0)}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {busy.active && <span className="text-xs text-[var(--muted-foreground)] animate-pulse">{busy.label}</span>}
        <NdiKnopf variante="editor" status={stand.ndi} plattform={stand.plattform} onSchalten={onNdi} />
        <div data-presenter="haupttaste" className="w-44 shrink-0">
          <TallyButton
            {...taste}
            onClick={() => {
              if (stand.praesentation?.active) void window.jmpr.present.stop();
              else void startPresentation();
            }}
          />
        </div>
      </div>
    </div>
  );
}
