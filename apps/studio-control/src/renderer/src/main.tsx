import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ladeFensterGeheimnis } from './sync/client';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Altfehler SC-S2: erst das Fenster-Geheimnis holen (im Browser ohne Preload sofort null), dann der erste Render; so trägt schon
// der erste Socket und der erste Abruf es.
await ladeFensterGeheimnis();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
