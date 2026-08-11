// Stage-0-Sondierlauf, vierter Teil: DIE Entscheidungsfrage.
//
//   Duerfen wir in einem echten Meeting Rohdaten aufnehmen?
//
// Lauf 3 hat gezeigt: die KONTO-Lizenz (HasRawdataLicense) fehlt. Das ist aber nur Weg 1.
// Weg 2 ist die lokale Aufnahme-Erlaubnis IM MEETING — genau der Weg, den die Roadmap fuer
// Stage 0 von Anfang an vorgesehen hat. Dieser Lauf prueft ihn:
//
//   InitSDK -> SDKAuth -> Join -> auf INMEETING warten -> CanStartRawRecording()
//   und, falls verweigert, RequestLocalRecordingPrivilege() beim Gastgeber.
//
// Es wird NICHTS aufgezeichnet und kein Bild abgegriffen. Der Lauf fragt nur nach der
// Erlaubnis und verlaesst das Meeting wieder.
//
// Eingaben aus der Umgebung (nichts davon gehoert ins Repo):
//   ZOOM_SDK_JWT           von run-join.mjs gesetzt
//   ZOOM_MEETING_ID        Meeting-Nummer, nur Ziffern
//   ZOOM_MEETING_PASSCODE  Kenncode
//   ZOOM_DISPLAY_NAME      Anzeigename im Meeting (Vorgabe "JM Connect Spike")

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cwchar>
#include <string>
#include <windows.h>
#include "zoom_sdk.h"
#include "auth_service_interface.h"
#include "meeting_service_interface.h"
#include "meeting_service_components/meeting_recording_interface.h"
#include "rawdata/zoom_rawdata_api.h"

USING_ZOOM_SDK_NAMESPACE

namespace {

volatile bool g_authDone = false;
AuthResult g_authResult = AUTHRET_NONE;

volatile bool g_inMeeting = false;
volatile bool g_meetingOver = false;
MeetingStatus g_lastStatus = MEETING_STATUS_IDLE;
int g_lastStatusResult = 0;

volatile bool g_privilegeAnswered = false;
RequestLocalRecordingStatus g_privilegeResult = RequestLocalRecording_Timeout;

const wchar_t* StatusName(MeetingStatus s) {
  switch (s) {
    case MEETING_STATUS_IDLE: return L"IDLE";
    case MEETING_STATUS_CONNECTING: return L"CONNECTING";
    case MEETING_STATUS_WAITINGFORHOST: return L"WAITINGFORHOST (Gastgeber hat noch nicht gestartet)";
    case MEETING_STATUS_INMEETING: return L"INMEETING";
    case MEETING_STATUS_DISCONNECTING: return L"DISCONNECTING";
    case MEETING_STATUS_RECONNECTING: return L"RECONNECTING";
    case MEETING_STATUS_FAILED: return L"FAILED";
    case MEETING_STATUS_ENDED: return L"ENDED";
    case MEETING_STATUS_LOCKED: return L"LOCKED";
    case MEETING_STATUS_UNLOCKED: return L"UNLOCKED";
    case MEETING_STATUS_IN_WAITING_ROOM: return L"IN_WAITING_ROOM (Warteraum - Gastgeber muss einlassen)";
    case MEETING_STATUS_WEBINAR_PROMOTE: return L"WEBINAR_PROMOTE";
    case MEETING_STATUS_WEBINAR_DEPROMOTE: return L"WEBINAR_DEPROMOTE";
    case MEETING_STATUS_JOIN_BREAKOUT_ROOM: return L"JOIN_BREAKOUT_ROOM";
    case MEETING_STATUS_LEAVE_BREAKOUT_ROOM: return L"LEAVE_BREAKOUT_ROOM";
    default: return L"UNKNOWN";
  }
}

class MeetingListener : public IMeetingServiceEvent {
 public:
  void onMeetingStatusChanged(MeetingStatus status, int iResult = 0) override {
    g_lastStatus = status;
    g_lastStatusResult = iResult;
    wprintf(L"  Status: %s\n", StatusName(status));
    if (status == MEETING_STATUS_INMEETING) g_inMeeting = true;
    if (status == MEETING_STATUS_FAILED || status == MEETING_STATUS_ENDED) g_meetingOver = true;
  }
  void onMeetingStatisticsWarningNotification(StatisticsWarningType) override {}
  void onMeetingParameterNotification(const MeetingParameter*) override {}
  void onSuspendParticipantsActivities() override {}
  void onAICompanionActiveChangeNotice(bool) override {}
  void onMeetingTopicChanged(const zchar_t*) override {}
  void onMeetingFullToWatchLiveStream(const zchar_t*) override {}
  void onUserNetworkStatusChanged(MeetingComponentType, ConnectionQuality, unsigned int, bool) override {}
  void onAppSignalPanelUpdated(IMeetingAppSignalHandler*) override {}
};

class RecordingListener : public IMeetingRecordingCtrlEvent {
 public:
  void onRecordPrivilegeChanged(bool bCanRec) override {
    wprintf(L"  onRecordPrivilegeChanged -> %s\n", bCanRec ? L"darf aufnehmen" : L"darf NICHT aufnehmen");
  }
  void onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus status) override {
    g_privilegeResult = status;
    g_privilegeAnswered = true;
  }
  void onRecordingStatus(RecordingStatus) override {}
  void onCloudRecordingStatus(RecordingStatus) override {}
  void onRequestCloudRecordingResponse(RequestStartCloudRecordingStatus) override {}
  void onLocalRecordingPrivilegeRequested(IRequestLocalRecordingPrivilegeHandler*) override {}
  void onStartCloudRecordingRequested(IRequestStartCloudRecordingHandler*) override {}
  void onCloudRecordingStorageFull(time_t) override {}
  void onEnableAndStartSmartRecordingRequested(IRequestEnableAndStartSmartRecordingHandler*) override {}
  void onSmartRecordingEnableActionCallback(ISmartRecordingEnableActionHandler*) override {}
  // ACHTUNG, Falle: die Rueckruf-Liste dieser Schnittstelle ist plattformabhaengig. Ein
  // `grep virtual` ueber den Header zeigt ALLE Methoden und verschluckt die
  // Praeprozessor-Waechter — `onTranscodingStatusChanged` gibt es NUR unter __linux__
  // (samt seinem Enum TranscodingStatus), die drei folgenden nur unter WIN32.
#if defined(WIN32)
  void onRecording2MP4Done(bool, int, const zchar_t*) override {}
  void onRecording2MP4Processing(int) override {}
  void onCustomizedLocalRecordingSourceNotification(ICustomizedLocalRecordingLayoutHelper*) override {}
#endif
};

/** Nachrichtenschleife, bis `flag` gesetzt ist oder die Zeit ablaeuft. */
bool PumpUntil(volatile bool& flag, int seconds) {
  const ULONGLONG deadline = GetTickCount64() + static_cast<ULONGLONG>(seconds) * 1000;
  MSG msg;
  while (!flag) {
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
    if (GetTickCount64() > deadline) return false;
    Sleep(20);
  }
  return true;
}

/**
 * Wie PumpUntil, bricht aber auch ab, wenn das Meeting scheitert oder endet.
 * Gibt alle 5 s ein Lebenszeichen aus - ohne das sieht ein Haenger genauso aus wie
 * ein abgestuerzter Prozess.
 */
bool PumpUntilInMeeting(int seconds) {
  const ULONGLONG start = GetTickCount64();
  const ULONGLONG deadline = start + static_cast<ULONGLONG>(seconds) * 1000;
  ULONGLONG nextBeat = start + 5000;
  MSG msg;
  while (!g_inMeeting && !g_meetingOver) {
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
    const ULONGLONG now = GetTickCount64();
    if (now >= nextBeat) {
      wprintf(L"  ... warte (%llu s), Status %s\n", (now - start) / 1000, StatusName(g_lastStatus));
      fflush(stdout);
      nextBeat = now + 5000;
    }
    if (now > deadline) return false;
    Sleep(20);
  }
  return g_inMeeting;
}

std::wstring EnvW(const char* name, const wchar_t* fallback) {
  char* raw = nullptr;
  size_t len = 0;
  if (_dupenv_s(&raw, &len, name) != 0 || !raw || len <= 1) {
    if (raw) free(raw);
    return fallback ? std::wstring(fallback) : std::wstring();
  }
  std::wstring out(raw, raw + strlen(raw));
  free(raw);
  return out;
}

const wchar_t* PrivilegeName(RequestLocalRecordingStatus s) {
  switch (s) {
    case RequestLocalRecording_Granted: return L"GRANTED (Gastgeber hat erlaubt)";
    case RequestLocalRecording_Denied: return L"DENIED (Gastgeber hat abgelehnt)";
    case RequestLocalRecording_Timeout: return L"TIMEOUT (keine Antwort)";
    default: return L"(unbekannt)";
  }
}

}  // namespace

int main() {
  const std::wstring jwt = EnvW("ZOOM_SDK_JWT", nullptr);
  const std::wstring idStr = EnvW("ZOOM_MEETING_ID", nullptr);
  const std::wstring psw = EnvW("ZOOM_MEETING_PASSCODE", L"");
  const std::wstring name = EnvW("ZOOM_DISPLAY_NAME", L"JM Connect Spike");

  if (jwt.empty() || idStr.empty()) {
    std::fwprintf(stderr, L"ZOOM_SDK_JWT und ZOOM_MEETING_ID muessen gesetzt sein.\n");
    return 2;
  }
  const UINT64 meetingNumber = _wcstoui64(idStr.c_str(), nullptr, 10);
  if (meetingNumber == 0) {
    std::fwprintf(stderr, L"ZOOM_MEETING_ID enthaelt keine gueltige Nummer.\n");
    return 2;
  }

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect Spike";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  // OHNE DIESE ZEILE HAENGT DER BEITRITT BEI CONNECTING.
  // Vorgabe ist der Zoom-UI-Modus: das SDK will ein eigenes Meeting-FENSTER aufmachen.
  // In einer Konsolenanwendung (und spaeter im utilityProcess) gibt es dafuer keinen
  // Platz, und der Beitritt kommt nie zum Abschluss. ENABLE_CUSTOMIZED_UI_FLAG schaltet
  // auf den eigenen UI-Modus um — genau das, was die Bridge braucht: kein Zoom-Fenster,
  // die Bilder kommen als Rohdaten heraus und gehen nach NDI.
  p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;

  if (InitSDK(p) != SDKERR_SUCCESS) {
    std::fwprintf(stderr, L"InitSDK fehlgeschlagen.\n");
    return 1;
  }

  // --- Anmelden (steht seit Lauf 3) ------------------------------------------
  IAuthService* auth = nullptr;
  if (CreateAuthService(&auth) != SDKERR_SUCCESS || !auth) {
    std::fwprintf(stderr, L"CreateAuthService fehlgeschlagen.\n");
    CleanUPSDK();
    return 1;
  }
  class AuthListener : public IAuthServiceEvent {
   public:
    void onAuthenticationReturn(AuthResult ret) override { g_authResult = ret; g_authDone = true; }
    void onLoginReturnWithReason(LOGINSTATUS, IAccountInfo*, LoginFailReason) override {}
    void onLogout() override {}
    void onZoomIdentityExpired() override {}
    void onZoomAuthIdentityExpired() override {}
    void onNotificationServiceStatus(SDKNotificationServiceStatus, SDKNotificationServiceError) override {}
  } authListener;
  auth->SetEvent(&authListener);

  AuthContext actx;
  actx.jwt_token = jwt.c_str();
  auth->SDKAuth(actx);
  if (!PumpUntil(g_authDone, 30) || g_authResult != AUTHRET_SUCCESS) {
    std::fwprintf(stderr, L"Anmeldung fehlgeschlagen (AuthResult=%d).\n", (int)g_authResult);
    DestroyAuthService(auth);
    CleanUPSDK();
    return 1;
  }
  wprintf(L"Anmeldung                    -> AUTHRET_SUCCESS\n");
  wprintf(L"HasRawdataLicense() (Weg 1)  -> %s\n\n", HasRawdataLicense() ? L"TRUE" : L"FALSE");

  // --- Meeting betreten ------------------------------------------------------
  IMeetingService* meeting = nullptr;
  if (CreateMeetingService(&meeting) != SDKERR_SUCCESS || !meeting) {
    std::fwprintf(stderr, L"CreateMeetingService fehlgeschlagen.\n");
    DestroyAuthService(auth);
    CleanUPSDK();
    return 1;
  }
  MeetingListener meetingListener;
  meeting->SetEvent(&meetingListener);

  JoinParam jp;
  jp.userType = SDK_UT_WITHOUT_LOGIN;
  JoinParam4WithoutLogin& w = jp.param.withoutloginuserJoin;
  w.meetingNumber = meetingNumber;
  w.userName = name.c_str();
  w.psw = psw.empty() ? nullptr : psw.c_str();
  w.isVideoOff = true;   // wir wollen nichts senden, nur fragen
  w.isAudioOff = true;

  wprintf(L"Betrete Meeting %llu als \"%s\" ...\n", meetingNumber, name.c_str());
  const SDKError joinErr = meeting->Join(jp);
  wprintf(L"Join()                       -> SDKError=%d (Ergebnis kommt asynchron)\n", (int)joinErr);

  int exitCode = 1;
  if (joinErr == SDKERR_SUCCESS && PumpUntilInMeeting(90)) {
    wprintf(L"\nIm Meeting.\n");

    IMeetingRecordingController* rec = meeting->GetMeetingRecordingController();
    if (!rec) {
      wprintf(L"GetMeetingRecordingController() lieferte nullptr - unerwartet.\n");
    } else {
      RecordingListener recListener;
      rec->SetEvent(&recListener);

      const SDKError can = rec->CanStartRawRecording();
      wprintf(L"\nCanStartRawRecording()       -> SDKError=%d %s\n", (int)can,
              can == SDKERR_SUCCESS ? L"(JA)" : L"(nein)");

      if (can == SDKERR_SUCCESS) {
        wprintf(L"\n==> WEG 2 TRAEGT. Rohdaten sind ohne Konto-Lizenz erreichbar.\n");
        wprintf(L"    Stage 0 ist damit durch, Stage 1 kann beginnen.\n");
        exitCode = 0;
      } else {
        const SDKError sup = rec->IsSupportRequestLocalRecordingPrivilege();
        wprintf(L"IsSupportRequestLocalRecordingPrivilege() -> SDKError=%d\n", (int)sup);
        if (sup == SDKERR_SUCCESS) {
          wprintf(L"Frage den Gastgeber nach der lokalen Aufnahme-Erlaubnis ...\n");
          wprintf(L"  >>> JETZT im Zoom-Fenster die Anfrage bestaetigen (60 s Zeit) <<<\n");
          const SDKError req = rec->RequestLocalRecordingPrivilege();
          if (req == SDKERR_SUCCESS && PumpUntil(g_privilegeAnswered, 60)) {
            wprintf(L"\nonLocalRecordingPrivilegeRequestStatus -> %s\n", PrivilegeName(g_privilegeResult));
            const SDKError can2 = rec->CanStartRawRecording();
            wprintf(L"CanStartRawRecording() erneut -> SDKError=%d %s\n", (int)can2,
                    can2 == SDKERR_SUCCESS ? L"(JA)" : L"(nein)");
            if (can2 == SDKERR_SUCCESS) {
              wprintf(L"\n==> WEG 2 TRAEGT nach Erlaubnis des Gastgebers.\n");
              wprintf(L"    Stage 0 ist damit durch, Stage 1 kann beginnen.\n");
              exitCode = 0;
            } else {
              wprintf(L"\n==> WEG 2 TRAEGT NICHT: auch mit Erlaubnis keine Rohdaten-Aufnahme.\n");
              exitCode = 3;
            }
          } else {
            wprintf(L"\nKeine Antwort auf die Anfrage (%s).\n",
                    req == SDKERR_SUCCESS ? L"Zeitueberschreitung" : L"Anfrage nicht abgesetzt");
            wprintf(L"Das ist KEIN Beweis fuer eine Ablehnung - es kam nur keine Antwort.\n");
            exitCode = 4;
          }
        } else {
          wprintf(L"\n==> Die Anfrage nach lokaler Aufnahme wird hier gar nicht unterstuetzt.\n");
          wprintf(L"    Meist heisst das: im Zoom-Portal ist die lokale Aufzeichnung nicht\n");
          wprintf(L"    freigegeben, oder wir haben keine Host-/Co-Host-Rechte.\n");
          exitCode = 3;
        }
      }
    }
  } else {
    wprintf(L"\nNicht ins Meeting gekommen. Letzter gemeldeter Status: %s", StatusName(g_lastStatus));
    if (g_lastStatus == MEETING_STATUS_FAILED) wprintf(L", iResult=%d", g_lastStatusResult);
    wprintf(L"\nStatus laut GetMeetingStatus(): %s\n", StatusName(meeting->GetMeetingStatus()));
    wprintf(L"Das ist KEINE Aussage ueber die Rohdaten-Frage - sie wurde nie gestellt.\n");
    if (g_lastStatus == MEETING_STATUS_WAITINGFORHOST)
      wprintf(L"Der Gastgeber muss das Meeting starten.\n");
    if (g_lastStatus == MEETING_STATUS_IN_WAITING_ROOM)
      wprintf(L"Wir haengen im Warteraum - der Gastgeber muss einlassen.\n");
    if (g_lastStatus == MEETING_STATUS_CONNECTING)
      wprintf(L"Haengt bei CONNECTING: laeuft das Meeting ueberhaupt? Stimmen Nummer und\n"
              L"Kenncode? Kommt der Rechner ins Netz (Firewall)?\n");
    exitCode = 4;
  }

  // Immer erst SAUBER VERLASSEN, dann abbauen. Ein DestroyMeetingService waehrend
  // CONNECTING hat den Prozess mit 0xC0000005 beendet - der Abbau raeumt Zustand weg,
  // an dem der SDK-Thread noch arbeitet.
  meeting->Leave(LEAVE_MEETING);
  PumpUntil(g_meetingOver, 10);
  meeting->SetEvent(nullptr);

  DestroyMeetingService(meeting);
  DestroyAuthService(auth);
  CleanUPSDK();

  //  0 = Rohdaten-Aufnahme erlaubt (Weg 2 traegt)
  //  3 = im Meeting, aber NICHT erlaubt
  //  4 = die Frage konnte gar nicht gestellt werden (nicht ins Meeting gekommen o. Ae.)
  //  1 = Fehler davor
  return exitCode;
}
