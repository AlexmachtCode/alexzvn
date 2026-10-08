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
export { type ScreenOption, type ScreenOutputSectionProps, type ScreenOutputView, SCREEN_TEXTE, SCREEN_AUTO, screenOutputView } from './abschnitte/screen-output';
export { ScreenOutputSection } from './abschnitte/ScreenOutputSection';
export { type ControlMode, type RemoteControlLauncherProps, type RemoteControlSectionProps, type RemoteControlView, REMOTE_TEXTE, remoteControlView } from './abschnitte/remote-control';
export { RemoteControlSection } from './abschnitte/RemoteControlSection';
export { type AudioDeviceOption, type AudioChoice, type AudioDeviceSectionProps, type AudioDeviceView, type AudioWahlView, AUDIO_TEXTE, PEGEL_MIN_DB, audioDeviceView } from './abschnitte/audio-device';
export { AudioDeviceSection } from './abschnitte/AudioDeviceSection';
export { type IveoSectionProps, type IveoView, IVEO_TEXTE, iveoView } from './abschnitte/iveo';
export { IveoSection } from './abschnitte/IveoSection';
export { type DataLinkSectionProps, type DataLinkView, DATALINK_TEXTE, dataLinkView } from './abschnitte/datalink';
export { DataLinkSection } from './abschnitte/DataLinkSection';
