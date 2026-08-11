#include "callbacks.h"
#include "emit.h"
#include "session.h"

namespace {
ParticipantsListener g_participantsListener;
}

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

  if (status == MEETING_STATUS_INMEETING) {
    // JEDES Mal, wenn inMeeting erreicht wird - auch nach einer
    // Wiederverbindung, weil sich dabei die Teilnehmer-IDs aendern (siehe
    // participantJson() in dieser Datei: GetUserID() gilt nur innerhalb der
    // Sitzung). Ein zweites roster ist darum kein Fehler, sondern die
    // einzige Moeglichkeit, die Karte nach einer Wiederverbindung wieder
    // richtigzustellen.
    IMeetingParticipantsController* ctrl = participantsCtrl();
    if (ctrl != nullptr) {
      ctrl->SetEvent(&g_participantsListener);
      emitRoster();
    }
  }
}

const char* roleName(UserRole r) {
  switch (r) {
    case USERROLE_HOST:                    return "host";
    case USERROLE_COHOST:                  return "coHost";
    case USERROLE_PANELIST:                return "panelist";
    case USERROLE_BREAKOUTROOM_MODERATOR:  return "breakoutModerator";
    case USERROLE_ATTENDEE:                return "attendee";
    default:                               return "none";
  }
}

std::string participantJson(IUserInfo* u) {
  if (u == nullptr) return "";
  const zchar_t* name = u->GetUserName();
  const zchar_t* pid = u->GetPersistentId();
  std::string out = "{\"id\":" + std::to_string(u->GetUserID());
  out += ",\"name\":\"" + jsonEscape(name ? name : L"") + "\"";
  // GetPersistentId() ist ueber Wiederverbindungen stabil und wird in Stage 2
  // der Schluessel fuer die NDI-Quellennamen. Er darf leer sein.
  out += ",\"persistentId\":\"" + jsonEscape(pid ? pid : L"") + "\"";
  out += std::string(",\"self\":") + (u->IsMySelf() ? "true" : "false");
  out += std::string(",\"videoOn\":") + (u->IsVideoOn() ? "true" : "false");
  out += std::string(",\"hasCamera\":") + (u->HasCamera() ? "true" : "false");
  out += std::string(",\"inWaitingRoom\":") + (u->IsInWaitingRoom() ? "true" : "false");
  out += std::string(",\"role\":\"") + roleName(u->GetUserRole()) + "\"}";
  return out;
}

void ParticipantsListener::onUserJoin(IList<unsigned int>* ids, const zchar_t*) {
  if (ids == nullptr) return;
  for (int i = 0; i < ids->GetCount(); ++i) {
    IUserInfo* u = participantsCtrl() ? participantsCtrl()->GetUserByUserID(ids->GetItem(i)) : nullptr;
    const std::string p = participantJson(u);
    if (!p.empty()) emitRaw("{\"ev\":\"joined\",\"p\":" + p + "}");
  }
}

void ParticipantsListener::onUserLeft(IList<unsigned int>* ids, const zchar_t*) {
  if (ids == nullptr) return;
  // NUR die ID: beim Eintreffen dieses Rueckrufs ist der Nutzer unter Umstaenden
  // nicht mehr abfragbar. Ein nullptr-Ergebnis waere kein Grund, das Ereignis zu
  // verschlucken - wer geht, muss gemeldet werden.
  for (int i = 0; i < ids->GetCount(); ++i) {
    emitRaw("{\"ev\":\"left\",\"id\":" + std::to_string(ids->GetItem(i)) + "}");
  }
}

void ParticipantsListener::onUserNamesChanged(IList<unsigned int>* ids) {
  if (ids == nullptr) return;
  for (int i = 0; i < ids->GetCount(); ++i) {
    IUserInfo* u = participantsCtrl() ? participantsCtrl()->GetUserByUserID(ids->GetItem(i)) : nullptr;
    if (u == nullptr) continue;
    const zchar_t* n = u->GetUserName();
    emitRaw("{\"ev\":\"renamed\",\"id\":" + std::to_string(ids->GetItem(i)) +
            ",\"name\":\"" + jsonEscape(n ? n : L"") + "\"}");
  }
}
