#include "callbacks.h"
#include "rawdata/zoom_rawdata_api.h"  // HasRawdataLicense()
#include "audio.h"
#include "emit.h"
#include "session.h"
#include "video.h"

namespace {
ParticipantsListener g_participantsListener;
}

void AuthListener::onAuthenticationReturn(AuthResult ret) {
  // Nur die Zahl auf die Rohrleitung - den Namen setzt TypeScript dazu.
  emitRaw("{\"ev\":\"auth\",\"code\":" + std::to_string(static_cast<int>(ret)) + "}");
  // Fuer den Menschen, der die Rohausgabe mitliest, zusaetzlich auf stderr.
  emitLog(std::wstring(L"Anmeldung beantwortet, AuthResult=") + std::to_wstring(static_cast<int>(ret)));
  // Das Rohdaten-Recht haengt am KONTO, nicht am Meeting - es steht also
  // bereits hier fest, lange vor dem ersten Abo. Ohne diese Zeile sieht ein
  // fehlendes Recht erst beim videoSubscribe als videoRendererFailed aus,
  // also wie ein Codefehler in einem Meeting, statt wie eine Kontofrage, die
  // schon vor dem Beitritt beantwortbar war. KEIN Protokollereignis: es ist
  // keine Tatsache, auf die ein Aufrufer eine Handlung stuetzt, sondern eine
  // Auskunft fuer den Menschen, der einen Abnahmelauf einrichtet.
  if (ret == AUTHRET_SUCCESS) {
    emitLog(std::wstring(L"Rohdaten-Lizenz dieses Kontos: HasRawdataLicense()=") +
            (HasRawdataLicense() ? L"true" : L"false"));
  }
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
      // Haelt fest, dass JE ein Empfaenger auf dem Teilnehmer-Regler stand -
      // siehe die Messstelle in sessionShutdown() (session.cpp), die genau
      // dieses Merkzeichen braucht, um ein stilles Uebergehen der Abmeldung
      // SICHTBAR zu machen, falls der Regler-Zeiger nach Leave() nullptr ist.
      markParticipantsListenerRegistered();
      emitRoster();
    }
    checkPrivilege();
  }

  // DAS MEETING IST VORBEI - die Erlaubnis daraus auch (Abschluss-Sichtung,
  // M2). Deckt den Weg ab, den sessionLeave() NICHT sieht: der Gastgeber
  // beendet das Meeting fuer alle, oder der Beitritt scheitert asynchron.
  // Ohne diese Zeile bliebe ein "canRecordRaw":true aus dem alten Meeting
  // stehen und liesse videoSubscribe() im naechsten Meeting durch, in dem
  // niemand je etwas erlaubt hat. Kein Ereignis dazu - siehe die
  // Begruendung am Doc-Kommentar von sessionClearCanRecordRaw() (session.h):
  // die Tatsache steht bereits als "status" auf der Leitung.
  //
  // ENDED UND FAILED, sonst nichts: DISCONNECTING/RECONNECTING sind
  // Uebergaenge, keine Enden (session.cpp zeigt die gemessene Folge
  // connecting -> disconnecting -> failed -> ended), und eine
  // Wiederverbindung fuehrt ohnehin ueber INMEETING wieder in
  // checkPrivilege() zurueck.
  if (status == MEETING_STATUS_ENDED || status == MEETING_STATUS_FAILED) {
    sessionClearCanRecordRaw();
    // Aus demselben Grund und an derselben Stelle: der Rohdaten-Schalter gilt
    // je MEETING. Bliebe er stehen, hielte das naechste Meeting ihn faelschlich
    // fuer bereits gelegt und subscribe() liefe ins Leere.
    sessionClearRawRecording();
    // Und die Abos gehoeren ebenfalls dem Meeting. GEMESSEN am 2026-08-13:
    // ohne diese Zeile ueberlebte ein Abo das Ende seiner Sitzung, und der
    // Herzschlag hielt eine NDI-Quelle am Leben, zu der es kein Meeting mehr
    // gab. NACH den beiden Zeilen darueber, damit ein Rueckruf, der waehrend
    // des Abbaus noch hereinkommt, keine Erlaubnis mehr vorfindet.
    videoMeetingEnded();
    // Das Ton-Abo gilt je Meeting - dieselbe Begruendung wie beim
    // Rohdaten-Schalter darueber.
    audioClearSubscribed();
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
    const unsigned int id = ids->GetItem(i);
    IUserInfo* u = participantsCtrl() ? participantsCtrl()->GetUserByUserID(id) : nullptr;
    const std::string p = participantJson(u);
    if (!p.empty()) emitRaw("{\"ev\":\"joined\",\"p\":" + p + "}");
    // ERST das bestehende "joined"-Ereignis, DANN das Abo-Umhaengen: sonst
    // stuende ein "video"-Ereignis mit reason:"rebound" fuer eine Kennung auf
    // der Leitung, die der Leser noch gar nicht kennt. Die Teilnehmerliste
    // (oben) und das Video-Abo (hier) sind zwei getrennte Fragen und
    // verschmelzen darum nicht zu einem Ereignis.
    videoParticipantJoined(id);
  }
}

void ParticipantsListener::onUserLeft(IList<unsigned int>* ids, const zchar_t*) {
  if (ids == nullptr) return;
  // NUR die ID: beim Eintreffen dieses Rueckrufs ist der Nutzer unter Umstaenden
  // nicht mehr abfragbar. Ein nullptr-Ergebnis waere kein Grund, das Ereignis zu
  // verschlucken - wer geht, muss gemeldet werden.
  for (int i = 0; i < ids->GetCount(); ++i) {
    const unsigned int id = ids->GetItem(i);
    emitRaw("{\"ev\":\"left\",\"id\":" + std::to_string(id) + "}");
    // Das bestehende "left"-Ereignis bleibt unveraendert - das Video-Abo (falls
    // eins besteht) ist eine ANDERE Frage und wird separat gemeldet.
    videoParticipantLeft(id);
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

void RecordingListener::onRecordPrivilegeChanged(bool bCanRec) {
  // Unaufgeforderter Rundruf des Reglers - eine ANDERE Ursache als eine
  // Antwort auf UNSER Gesuch (onLocalRecordingPrivilegeRequestStatus unten)
  // oder die synchrone Sofortpruefung (checkPrivilege() in session.cpp). Drei
  // Ursachen koennen `canRecordRaw:true` melden, byte-gleich bis auf dieses
  // Feld - "source" unterscheidet sie (Nachbesserung 1, Owner-Entscheidung:
  // Befund A). Vergeben auch im false-Fall, damit das Feld nie mal da ist und
  // mal nicht.
  // Melde-Stelle 2/5 (Task 3): siehe sessionSetCanRecordRaw() in session.h.
  // GENAU dieser Ruf ist der, der in BEIDE Richtungen kippt - bCanRec ist
  // hier wortgleich der Wert, der auch auf die Rohrleitung geht, also
  // spiegelt g_canRecordRaw ab jetzt sofort einen Entzug (bCanRec == false)
  // ebenso wie eine Freigabe.
  sessionSetCanRecordRaw(bCanRec);
  emitRaw(std::string("{\"ev\":\"privilege\",\"canRecordRaw\":") + (bCanRec ? "true" : "false") +
          ",\"source\":\"broadcast\"}");
}

void RecordingListener::onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus status) {
  // Beantwortet die aus checkPrivilege() noch offene Anfrage - siehe
  // sessionPrivilegePending()/sessionPrivilegeAnswered() in session.h. Gilt
  // fuer ALLE drei Auspraegungen unten (Granted/Denied/Timeout): sobald diese
  // Rueckmeldung eintrifft, ist NICHTS mehr offen, unabhaengig vom Inhalt der
  // Antwort. Deshalb steht der Ruf hier oben, nicht in jedem einzelnen Zweig.
  sessionPrivilegeAnswered();

  if (status == RequestLocalRecording_Granted) {
    // Melde-Stelle 3/5 (Task 3): siehe sessionSetCanRecordRaw() in session.h.
    sessionSetCanRecordRaw(true);
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":true,\"source\":\"requestAnswer\"}");
    return;
  }
  if (status == RequestLocalRecording_Denied) {
    // Melde-Stelle 4/5 (Task 3): siehe sessionSetCanRecordRaw() in session.h.
    sessionSetCanRecordRaw(false);
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"source\":\"requestAnswer\",\"denied\":true}");
    return;
  }
  // Timeout ist KEIN Beweis fuer eine Ablehnung - es kam nur keine Antwort.
  // Deshalb ausdruecklich nicht als `denied` melden.
  //
  // "timedOut":true unterscheidet diese ENDGUELTIGE Zeile von der
  // VORUEBERGEHENDEN "gerade gefragt, Antwort steht noch aus"-Zeile aus
  // checkPrivilege() (session.cpp) - beide waren vorher byte-gleich
  // ({"canRecordRaw":false,"requested":true}), obwohl der eine Zustand
  // fuer immer gilt und der andere sich noch aendern kann. Wer auf die
  // vorherige Zeile wartet, wuerde ohne dieses Feld beim Timeout fuer immer
  // warten (Nachbesserung 1, Owner-Entscheidung: Befund B).
  //
  // Melde-Stelle 5/5 (Abschluss-Sichtung, M1): DIESER Zweig schickte
  // "canRecordRaw":false auf die Leitung, ohne sessionSetCanRecordRaw() zu
  // rufen - es waren also nie vier Melde-Stellen, sondern fuenf, und eine
  // davon liess die beiden Wahrheiten auseinanderlaufen. Praktisch fiel das
  // bisher nicht auf, weil der Stand in diesem Ablauf ohnehin schon false
  // war (checkPrivilege() fragt erst, wenn CanStartRawRecording()
  // fehlschlug); es auf "faellt schon nicht auf" zu gruenden, ist aber
  // genau die Annahme, die beim naechsten Umbau bricht. Die Regel am
  // Doc-Kommentar von sessionSetCanRecordRaw() gilt ohne Ausnahme: JEDE
  // Stelle, die den Wert auf die Rohrleitung schreibt, merkt ihn sich auch.
  sessionSetCanRecordRaw(false);
  emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"source\":\"requestAnswer\",\"requested\":true,\"timedOut\":true}");
  emitLog(L"Keine Antwort auf die Anfrage nach lokaler Aufnahme (Zeitueberschreitung).");
}
