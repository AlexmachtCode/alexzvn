// Hauptfenster von JM Connect (UX Welle 2b, Connect d1 und d2): seit Task 23 aufgeteilt. Die Wurzel-View
// (views/ConnectOberflaeche.tsx) hält Raum-Client, Abos (auch das Zoom-Abbild), Fernbefehle, die laufenden Zoom-Aufrufe und den
// Panelzustand und baut den Rahmen; die linke Spalte steht in views/CloudRaum.tsx, die rechte in views/ZoomSpalte.tsx, die
// Fußzeile in views/Fusszeile.tsx, das Panel in views/Einstellungen.tsx (mit views/CloudZugang.tsx, zoom/ZoomEinrichtung.tsx und
// zoom/ZoomVorgaben.tsx).
import { ConnectOberflaeche } from './views/ConnectOberflaeche';

export function App(): JSX.Element {
  return <ConnectOberflaeche />;
}
