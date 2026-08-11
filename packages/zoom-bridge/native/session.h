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
 *
 * STAND TASK 5: es gibt noch weder Meeting- noch Auth-Dienst, darum macht
 * diese Funktion bisher NUR CleanUPSDK. Leave, DestroyMeetingService und
 * DestroyAuthService kommen mit Task 6 und 7 dazu. Der Ablauf oben beschreibt
 * das ZIEL der spaeteren Stufen, nicht den heutigen IST-Zustand.
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

/**
 * Meldet sich mit dem fertigen JWT an. Das Ergebnis kommt ASYNCHRON ueber
 * onAuthenticationReturn - ohne laufende Nachrichtenschleife nie. Deshalb
 * meldet diese Funktion selbst nichts ausser einem Fehler beim Absetzen.
 * Das JWT wird NIRGENDS ausgegeben.
 */
void sessionAuth(const std::string& jwtUtf8);

/**
 * Ob eine mit sessionAuth() abgesetzte Anmeldung noch auf die asynchrone
 * Antwort wartet. Der Hauptthread braucht das: bei geschlossenem stdin darf
 * ein Lauf nicht abbrechen, waehrend eine Anmeldung noch offen ist - sonst
 * wird die Antwort verschluckt. GEMESSEN: EOF direkt nach "auth" liefert ohne
 * diese Pruefung NIE ein {"ev":"auth",...} - weder ueber PowerShells Pipe
 * (3/3 Laeufen) noch ueber Node child_process.spawn (5/5 Laeufen), jeweils
 * deterministisch.
 */
bool sessionAuthPending();

/** Von AuthListener::onAuthenticationReturn gerufen, sobald die Antwort da ist. */
void sessionAuthAnswered();
