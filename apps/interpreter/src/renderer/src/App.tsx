import { InterpreterOberflaeche } from '@/views/InterpreterOberflaeche';

// Wurzel des Interpreter-Renderers (UX Welle 2a, Interpreter d): zeigt die Oberfläche ohne Bedingung und ohne key. Die Audio-Engine,
// ihr Abo mit destroy, die Geräteliste mit der Mikrofon-Probe und die Regler-Effekte laufen in InterpreterOberflaeche, die so nie
// abgebaut wird, solange das Fenster lebt (Funktionsliste Nr. 47, Befund 9).
export function App(): JSX.Element {
  return <InterpreterOberflaeche />;
}
