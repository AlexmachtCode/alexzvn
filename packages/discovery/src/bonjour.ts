// Gemeinsame Bonjour-Fabrik von advertise() und discover().
//
// bonjour-service setzt ohne Fehler-Rückruf `errorCallback = (err) => { throw err; }`
// und ruft ihn, wenn eine mDNS-Antwort nicht gesendet werden kann (z. B. Netz kurz
// weg: `send EHOSTUNREACH 224.0.0.251:5353`). Das wirft aus einem Socket-Callback →
// uncaughtException → App-Absturz (JM Connect, 02.11.2026). Darum bekommt jede
// Instanz einen Rückruf, der NIE wirft.
//
// Default-Import (nicht `{ Bonjour }`): das Paket ist `export =` (CJS) und liefert
// den Namen unter reinem Node-ESM nicht als Named Export; der Default geht in Node
// und in Bundlern.
import Bonjour from 'bonjour-service';

export function neuesBonjour(onError?: (e: Error) => void): Bonjour {
  const behandeln = (e: Error): void => {
    try {
      if (onError) onError(e);
      else console.warn('[discovery] mDNS-Fehler (ignoriert): ' + e.message);
    } catch {
      /* ein werfender onError darf nie nach außen dringen */
    }
  };
  const bonjour = new Bonjour(undefined, behandeln);
  // Zweiter Absturzweg: multicast-dns emittiert 'error' bei EACCES/EADDRINUSE/Bind-Fehlern
  // (z. B. Port 5353 belegt); bonjour-service hängt dafür keinen Listener an → ohne
  // diesen wäre es eine uncaughtException.
  bonjour.server.mdns.on('error', behandeln);
  return bonjour;
}
