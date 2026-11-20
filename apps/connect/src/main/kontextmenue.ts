import type { MenuItemConstructorOptions } from 'electron';

/**
 * Rechtsklick-Menü für bearbeitbare Felder (#301): Ausschneiden / Kopieren / Einfügen.
 * Reine Funktion (kein Electron zur Laufzeit → mit tsx testbar). `null` = kein Menü
 * (Ziel nicht bearbeitbar). Passwortfelder: Electron meldet canCut/canCopy selbst
 * als false, daher hier nichts Eigenes.
 */
export function kontextMenueVorlage(p: {
  isEditable: boolean;
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean };
}): MenuItemConstructorOptions[] | null {
  if (!p.isEditable) return null;
  return [
    { role: 'cut', label: 'Ausschneiden', enabled: p.editFlags.canCut },
    { role: 'copy', label: 'Kopieren', enabled: p.editFlags.canCopy },
    { role: 'paste', label: 'Einfügen', enabled: p.editFlags.canPaste },
  ];
}
