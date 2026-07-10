import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OutputView } from './views/OutputView';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Zweitbildschirm-Ausgabe (#161-Muster): dasselbe Fenster-Bundle wird per ?view=output als reiner
// Vollbild-Monitor-Feed geladen (keine Bedienoberfläche). Weiche am Einstiegspunkt, damit App selbst
// frei von view-Verzweigungen bleibt.
const isOutputView = new URLSearchParams(window.location.search).get('view') === 'output';

createRoot(root).render(
  <StrictMode>{isOutputView ? <OutputView /> : <App />}</StrictMode>,
);
