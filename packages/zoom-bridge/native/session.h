#pragma once
#include <string>
// Muss VOR dem Teilnehmer-Header stehen - dieselbe Uebersetzungsfalle wie in
// callbacks.h: zoom_sdk_def.h setzt HWND unter WIN32 als bereits bekannt
// voraus und typedef't es selbst nur im Nicht-WIN32-Zweig. session.cpp
// bindet session.h VOR seinem eigenen windows.h ein (siehe dort) - dieser
// Header muss darum selbst dafuer sorgen, dass windows.h zuerst steht.
#include <windows.h>
// EIGENE, im Brief nicht erwaehnte Uebersetzungsfalle, GEMESSEN (C3646/C2059/
// C2238 in Zeile 139 von meeting_participants_ctrl_interface.h): dieser
// Header benutzt `AudioType` (IUserInfo::GetAudioJoinType()), deklariert es
// aber nicht selbst und inkludiert auch nicht den Header, der es deklariert.
// Ohne meeting_audio_interface.h VOR dem Teilnehmer-Header ist AudioType an
// dieser Stelle unbekannt, und der Parser verliert danach die Deklaration.
#include "meeting_service_components/meeting_audio_interface.h"
#include "meeting_service_components/meeting_participants_ctrl_interface.h"
// GEMESSEN, KEINE eigene Falle: meeting_participants_ctrl_interface.h bindet
// diesen Header bereits selbst ein, diese Zeile ist die explizite,
// unabhaengige Absicherung fuer diese Uebersetzungseinheit - gebraucht, weil
// dieser Header selbst IMeetingRecordingController* als Rueckgabetyp
// deklariert (recordingCtrl() unten).
#include "meeting_service_components/meeting_recording_interface.h"

USING_ZOOM_SDK_NAMESPACE

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

/** Der Teilnehmer-Controller, oder nullptr wenn kein Meeting laeuft. */
IMeetingParticipantsController* participantsCtrl();

/** Vollbild der Anwesenden als ein roster-Ereignis. */
void emitRoster();

/**
 * Haelt fest, dass der Teilnehmer-Empfaenger (g_participantsListener, siehe
 * callbacks.cpp) JE auf dem Teilnehmer-Regler registriert wurde. Gebraucht von
 * der Messstelle in sessionShutdown(): liefert participantsCtrl() beim Abbau
 * nullptr, obwohl hier schon einmal registriert wurde, wird das SICHTBAR
 * gemeldet statt die Abmeldung still zu uebergehen - die SDK-Kopfdateien
 * klaeren nicht, ob der Regler-Zeiger nach einem durchlaufenen Leave() noch
 * gueltig bleibt.
 */
void markParticipantsListenerRegistered();

/** Der Aufnahme-Regler, oder nullptr wenn kein Meeting laeuft. */
IMeetingRecordingController* recordingCtrl();

/**
 * Fragt die Rohdaten-Aufnahme-Erlaubnis ab und, wenn noetig, beim Gastgeber
 * an (RequestLocalRecordingPrivilege). Meldet {"ev":"privilege",...} bzw.
 * {"ev":"error","where":"privilege",...}. Stage 1 zeichnet NICHTS auf: diese
 * Funktion ruft StartRawRecording() NICHT - es steht nirgends im Quelltext.
 *
 * Owner-Entscheidung: "automatisch anfragen, einmal freigeben" - die Bruecke
 * fragt die Erlaubnis SELBST an, sie wartet nicht auf einen externen Befehl.
 * Deshalb gibt es dafuer keinen eigenen "cmd" in main.cpp - der Aufruf steht
 * in MeetingListener::onMeetingStatusChanged (callbacks.cpp), ausgeloest vom
 * Status INMEETING, genau wie emitRoster().
 */
void checkPrivilege();

/**
 * Ob eine mit checkPrivilege() abgesetzte RequestLocalRecordingPrivilege()
 * noch auf die asynchrone Antwort wartet (analog sessionAuthPending()/
 * sessionJoinPending() - siehe dort). Der Hauptthread braucht das aus
 * demselben Grund: bei geschlossenem stdin darf ein Lauf nicht abbrechen,
 * bevor die Antwort ueber onLocalRecordingPrivilegeRequestStatus da ist -
 * sonst verschwindet sie spurlos, genau wie es fuer "auth" ohne
 * sessionAuthPending() GEMESSEN wurde. NICHT GEMESSEN (kein echtes Meeting
 * verfuegbar ohne Owner-Freigabe): ob dieselbe Rennbedingung hier tatsaechlich
 * auftritt - die Anfrage ist aber, wie bei "auth"/"join", ein Gesuch mit
 * asynchroner Antwort ueber genau denselben Mechanismus (SDK-Rueckruf nach
 * einer Pumprunde), darum dieselbe Vorsichtsmassnahme.
 */
bool sessionPrivilegePending();

/** Von RecordingListener::onLocalRecordingPrivilegeRequestStatus gerufen, sobald die Antwort da ist. */
void sessionPrivilegeAnswered();
