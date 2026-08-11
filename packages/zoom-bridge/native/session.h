#pragma once
#include <string>

/**
 * InitSDK mit den Setzungen der Bridge. Meldet {"ev":"ready",...} bei Erfolg und
 * {"ev":"error","where":"init","code":n} sonst.
 */
bool sessionInit();

/**
 * Abbau in der EINZIG zulaessigen Reihenfolge:
 *   Leave -> pumpen bis ENDED/IDLE oder 5 s -> DestroyMeetingService
 *   -> DestroyAuthService -> CleanUPSDK
 * Ein DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
 * 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
 * noch arbeitet.
 */
void sessionShutdown();

/** Eine Runde Win32-Nachrichten abarbeiten. Ohne sie kommt kein Rueckruf an. */
void pumpOnce();

/**
 * Liest ein flaches Zeichenkettenfeld aus einer JSON-Zeile. Reicht fuer die fuenf
 * Befehle der Bridge; eine JSON-Bibliothek waere hier teurer als der Leser und
 * muesste in Stage 4 mit ausgeliefert und lizenzgeprueft werden.
 * Gibt "" zurueck, wenn das Feld fehlt.
 */
std::string fieldFromJson(const std::string& line, const char* key);

/** Der Wert von "cmd", oder "" wenn die Zeile keiner ist. */
std::string cmdOf(const std::string& line);
