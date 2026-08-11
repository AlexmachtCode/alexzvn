#include "callbacks.h"
#include "emit.h"
#include "session.h"

void AuthListener::onAuthenticationReturn(AuthResult ret) {
  // Nur die Zahl auf die Rohrleitung - den Namen setzt TypeScript dazu.
  emitRaw("{\"ev\":\"auth\",\"code\":" + std::to_string(static_cast<int>(ret)) + "}");
  // Fuer den Menschen, der die Rohausgabe mitliest, zusaetzlich auf stderr.
  emitLog(std::wstring(L"Anmeldung beantwortet, AuthResult=") + std::to_wstring(static_cast<int>(ret)));
  // Meldet session.cpp, dass die Anmeldung nicht mehr offen ist - siehe
  // sessionAuthPending() in session.h.
  sessionAuthAnswered();
}

const char* statusName(MeetingStatus s) {
  switch (s) {
    case MEETING_STATUS_IDLE:            return "idle";
    case MEETING_STATUS_CONNECTING:      return "connecting";
    // ACHTUNG: ZWEI verschiedene Wartezustaende, die NICHT verschmelzen duerfen:
    //   WAITINGFORHOST  = das Meeting laeuft noch gar nicht -> "Meeting starten"
    //   IN_WAITING_ROOM = es laeuft, wir stehen davor       -> "Bridge einlassen"
    // Zwei verschiedene Handlungsanweisungen an den Operator.
    case MEETING_STATUS_WAITINGFORHOST:  return "waitingForHost";
    case MEETING_STATUS_IN_WAITING_ROOM: return "waitingRoom";
    case MEETING_STATUS_INMEETING:       return "inMeeting";
    case MEETING_STATUS_DISCONNECTING:   return "disconnecting";
    case MEETING_STATUS_RECONNECTING:    return "reconnecting";
    case MEETING_STATUS_FAILED:          return "failed";
    case MEETING_STATUS_ENDED:           return "ended";
    default:                             return "other";
  }
}

void MeetingListener::onMeetingStatusChanged(MeetingStatus status, int iResult) {
  // `raw` traegt den SDK-Wert immer mit - auch bei "other". Ein Status, der
  // stillschweigend verschwindet, ist eine Anzeige, die luegt.
  //
  // `code` ist iResult und bedeutet JE NACH STATUS etwas anderes: bei FAILED ein
  // MeetingFailCode, bei ENDED ein EndMeetingReason, sonst nichts Verwertbares.
  // Deshalb gehen beide Werte hinaus und ausgelegt wird erst in TypeScript.
  emitRaw(std::string("{\"ev\":\"status\",\"status\":\"") + statusName(status) +
          "\",\"raw\":" + std::to_string(static_cast<int>(status)) +
          ",\"code\":" + std::to_string(iResult) + "}");
  // Meldet session.cpp, dass die ERSTE Statusmeldung des Beitritts da ist -
  // siehe sessionJoinPending() in session.h. Derselbe Verschluck-Mechanismus
  // wie bei der Anmeldung: ohne diesen Ruf koennte EOF direkt nach "join" den
  // Beitritt beenden, bevor auch nur EINE Pumprunde eine Rueckmeldung bringt.
  sessionJoinAnswered();
}
