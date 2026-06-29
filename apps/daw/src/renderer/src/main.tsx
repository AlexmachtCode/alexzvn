import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
const reactRoot = createRoot(root);

// Das Mixer-Popout-Fenster (#95) lädt denselben Renderer mit `#mixer` und zeigt
// nur den Mixer — bewusst per dynamischem Import, damit App + Audio-Engine im
// Popout gar nicht erst geladen werden.
if (window.location.hash === '#mixer') {
  void import('./components/MixerPopout').then(({ MixerPopout }) => {
    reactRoot.render(
      <StrictMode>
        <MixerPopout />
      </StrictMode>,
    );
  });
} else {
  void import('./App').then(({ App }) => {
    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
