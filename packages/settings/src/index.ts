// @jm/settings – Einstellungs-Abschnitte der Suite (Spec 6). Jede Aufgabe hängt ihre Zeilen am Ende an.
export {
  type SectionStatus,
  type SectionBase,
  type SectionInput,
  type AbschnittZustand,
  ABSCHNITT_TEXTE,
  st,
  STATUS_UNBEKANNT,
  fehlerStatus,
  istGesperrt,
  hatFehler,
  abschnittStatusItem,
} from './vertrag';
export { SectionFrame, type SectionFrameProps } from './SectionFrame';
export { type NdiOutputSectionProps, type NdiOutputView, NDI_TEXTE, ndiOutputView } from './abschnitte/ndi-output';
export { NdiOutputSection } from './abschnitte/NdiOutputSection';
