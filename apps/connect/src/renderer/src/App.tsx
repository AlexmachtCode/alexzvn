// Hauptfenster von JM Connect (UX Welle 2b, Connect d1): seit Task 23 aufgeteilt. Die Wurzel-View (views/ConnectOberflaeche.tsx)
// hält Raum-Client, Abos, Fernbefehle und Panelzustand und baut den Rahmen; die linke Spalte steht in views/CloudRaum.tsx, die
// Fußzeile in views/Fusszeile.tsx, das Panel in views/Einstellungen.tsx (mit views/CloudZugang.tsx). Die Zoom-Karte bleibt bis
// Task 24 in zoom/ZoomCard.tsx.
import { ConnectOberflaeche } from './views/ConnectOberflaeche';

export function App(): JSX.Element {
  return <ConnectOberflaeche />;
}
