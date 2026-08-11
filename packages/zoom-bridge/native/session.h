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
 * STAND TASK 7: der Ablauf oben ist vollstaendig umgesetzt - sessionLeave()
 * (Leave + pumpen) laeuft VOR DestroyMeetingService, das wiederum vor
 * DestroyAuthService und CleanUPSDK steht. Wird ohne laufendes Meeting bzw.
 * ohne Auth-Dienst gerufen, ueberspringt der jeweilige Schritt sich selbst
 * (g_meeting/g_auth bleiben nullptr, siehe session.cpp).
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

/**
 * Beitritt zu einem Meeting per Nummer/Kenncode/Anzeigename. Das Ergebnis
 * kommt ASYNCHRON als Statusfolge ueber MeetingListener::onMeetingStatusChanged
 * (siehe callbacks.cpp) - bei Erfolg des Aufrufs selbst wird hier NICHTS
 * gemeldet. Die Bridge tritt STUMM und OHNE BILD bei: sie sendet nichts,
 * sie hoert nur zu.
 */
void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8);

/**
 * Verlassen in der EINZIG zulaessigen Reihenfolge: Leave(), dann bis zu 5 s
 * pumpen, bis der Meeting-Status ENDED/IDLE erreicht - erst danach darf
 * DestroyMeetingService laufen (siehe sessionShutdown()). Ein
 * DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
 * 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
 * noch arbeitet. sessionLeave() ist ohne laufendes Meeting (g_meeting ==
 * nullptr) ein no-op.
 */
void sessionLeave();

/**
 * Ob ein mit sessionJoin() erfolgreich abgesetzter Beitritt noch auf die
 * ERSTE asynchrone Statusmeldung wartet (analog sessionAuthPending() - siehe
 * dort). Der Hauptthread braucht das aus demselben Grund: bei geschlossenem
 * stdin darf ein Lauf nicht abbrechen, bevor auch nur EINE Pumprunde eine
 * Rueckmeldung ueber onMeetingStatusChanged bringen konnte - sonst verschwindet
 * der Beitritt spurlos, genau wie es fuer "auth" ohne sessionAuthPending()
 * GEMESSEN wurde. NICHT gemessen (kein echtes Meeting verfuegbar): ob die
 * gleiche 10-s-Frist wie bei "auth" fuer den Beitritt reicht - siehe der
 * Code "joinEofTimeout" in main.cpp.
 */
bool sessionJoinPending();

/**
 * Von MeetingListener::onMeetingStatusChanged gerufen, sobald die erste
 * Statusmeldung eines Beitritts da ist. NICHT dasselbe wie "das Meeting ist
 * jetzt in einem Endzustand" - schon "connecting" zaehlt, denn das genuegt,
 * um sessionJoinPending() aufzuloesen: es ist mindestens EINE Rueckmeldung
 * angekommen, EOF wuerde sie also nicht mehr verschlucken.
 */
void sessionJoinAnswered();
