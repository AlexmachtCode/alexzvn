import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from './views/EditorView';
import { PresenterView } from './views/PresenterView';
import { AudienceView } from './views/AudienceView';
import { useProject } from './store/project';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const view = window.jmpr?.view ?? 'editor';

// Show-Integration (B4): ein vom Launcher per Deep-Link angefordertes .jmpres-
// Dokument im Editor-Fenster laden. Nur die Editor-Ansicht empfängt das Event.
if (view === 'editor') {
  // Über die Reihe der Lieferungen und als „ersetzen“: ohne Rückfrage wie bisher, aber nie
  // mitten in einen laufenden Import, und eine offene Frage verfällt (sonst legte eine spätere
  // Antwort ihre Dateien ins Show-Projekt).
  window.jmpr?.files?.onOpenProject?.((p) => {
    void useProject.getState().oeffneGeladene({ files: [], projekt: p, hinweise: [] }, 'ersetzen');
  });
  // PRESENTER OPEN (Issue #81): vom Hauptprozess gelesene PDF/Bild/Office-Dateien
  // als (frische) Präsentation vorlegen.
  window.jmpr?.files?.onOpenFiles?.((p) => {
    void useProject.getState().oeffneGeladene(p, p.modus);
  });
}

createRoot(root).render(
  <StrictMode>
    {view === 'presenter' ? (
      <PresenterView />
    ) : view === 'audience' ? (
      <AudienceView />
    ) : (
      <EditorView />
    )}
  </StrictMode>,
);
