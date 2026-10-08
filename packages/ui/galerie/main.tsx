// Einstieg der Galerie. Ohne Parameter die Übersicht; `?ansicht=shell&…` zeigt nur den Rahmen (für die iframes).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './galerie.css';
import { Galerie } from './Galerie';
import { leseShellParameter, ShellSeite } from './ShellSeite';

const parameter = new URLSearchParams(window.location.search);
const wurzel = document.getElementById('root');
if (wurzel) {
  createRoot(wurzel).render(
    <StrictMode>
      {parameter.get('ansicht') === 'shell' ? <ShellSeite {...leseShellParameter(parameter)} /> : <Galerie />}
    </StrictMode>,
  );
}
