import { CaptionOberflaeche } from '@/views/CaptionOberflaeche';

// Wurzel des Caption-Renderers (UX Welle 2a, Caption d): zeigt die Oberfläche ohne Bedingung und ohne key. Die Engine, die
// Aufnahme-Effekte, das Laden des Zustands und die Geräteliste laufen in CaptionOberflaeche, die so nie abgebaut wird
// (Funktionsliste Nr. 1, Befund 14).
export function App() {
  return <CaptionOberflaeche />;
}
