// PIN-Feld der Presenter-Kopplung (Altfehler Stufe 2, SD-5): die PIN steht verdeckt im Feld, „Anzeigen“ zeigt sie, und sie gilt erst
// mit „Setzen“ – wie Host und Port in PeersSection (@jm/settings). Tippen ändert nur den Entwurf; kein Enter, kein Tastenhörer. Der
// Filter auf Ziffern und höchstens 8 Zeichen bleibt in aktionen.pin. Eine neue PIN von außen (Show-Deep-Link) ersetzt den Entwurf,
// wie in PeerZeile. Platzhalter und Tooltip wie bisher.
import { PEERS_TEXTE } from '@jm/settings';
import { Button, TextInput } from '@jm/ui';
import { useEffect, useState } from 'react';
import { STAGE_TEXTE } from '@/lib/oberflaeche';

export interface PinFeldAnsichtProps {
  entwurf: string;
  sichtbar: boolean;
  onTippen: (t: string) => void;
  onAnzeigen: () => void;
  onSetzen: () => void;
}

/** Reine Ansicht ohne Hooks: Feld (verdeckt oder sichtbar), „Anzeigen“/„Verbergen“ und „Setzen“. */
export function PinFeldAnsicht(p: PinFeldAnsichtProps): React.JSX.Element {
  const T = STAGE_TEXTE.kopplung;
  return (
    <div className="flex items-center gap-2">
      <TextInput
        type={p.sichtbar ? 'text' : 'password'}
        value={p.entwurf}
        onChange={p.onTippen}
        inputMode="numeric"
        autoComplete="off"
        placeholder={T.pin}
        title={T.pinHinweis}
      />
      <Button type="button" variant="outline" size="sm" uppercase={false} className="shrink-0" aria-pressed={p.sichtbar} onClick={p.onAnzeigen}>
        {p.sichtbar ? T.verbergen : T.anzeigen}
      </Button>
      <Button type="button" variant="outline" size="sm" uppercase={false} className="shrink-0" onClick={p.onSetzen}>
        {PEERS_TEXTE.setzen}
      </Button>
    </div>
  );
}

/** Hülle mit Entwurf und Sichtbarkeit; „Setzen“ übergibt den Entwurf an setzen (aktionen.pin). */
export function PinFeld({ wert, setzen }: { wert: string; setzen: (pin: string) => void }): React.JSX.Element {
  const [entwurf, setEntwurf] = useState(wert);
  const [sichtbar, setSichtbar] = useState(false);
  useEffect(() => setEntwurf(wert), [wert]);
  return <PinFeldAnsicht entwurf={entwurf} sichtbar={sichtbar} onTippen={setEntwurf} onAnzeigen={() => setSichtbar((s) => !s)} onSetzen={() => setzen(entwurf)} />;
}
