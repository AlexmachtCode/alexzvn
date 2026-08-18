// Die Rueckruf-Klassen des SDK.
//
// ACHTUNG: Diese Schnittstellen sind REIN VIRTUELL und plattformabhaengig: einzelne
// Methoden stehen hinter `#if defined(WIN32)` oder `#if defined(__linux__)`.
// Ein `grep virtual` ueber den Kopfsatz zeigt alle und verschluckt die Waechter.
// Fehlt eine Methode, bleibt die Klasse abstrakt und uebersetzt nicht - das
// faengt der Compiler. Eine ZUVIEL (die es unter Windows nicht gibt) ergibt
// dagegen einen unverstaendlichen C2061 in einer fremden Zeile.
#pragma once
#include <string>
#include "session.h"
// Muss VOR zoom_sdk.h stehen: zoom_sdk_def.h setzt HWND unter WIN32 als
// bereits bekannt voraus und typedef't es selbst nur im Nicht-WIN32-Zweig.
// Ohne diese Reihenfolge scheitert die Uebersetzung in zoom_sdk_def.h mit
// einer Kaskade aus C3646/C2065/C4430 - gemessen, siehe session.cpp, wo
// windows.h aus demselben Grund vor zoom_sdk.h steht. Gilt auch fuer den
// Teilnehmer-Header unten - session.h bringt windows.h bereits selbst mit,
// diese Zeile hier ist trotzdem die zweite, unabhaengige Absicherung fuer
// diese Uebersetzungseinheit.
#include <windows.h>
#include "zoom_sdk.h"
#include "auth_service_interface.h"
#include "meeting_service_interface.h"
// EIGENE, im Brief nicht erwaehnte Uebersetzungsfalle, GEMESSEN (C3646/C2059/
// C2238 in Zeile 139 von meeting_participants_ctrl_interface.h): dieser
// Header benutzt `AudioType` (IUserInfo::GetAudioJoinType()), deklariert es
// aber nicht selbst und inkludiert auch nicht den Header, der es deklariert -
// siehe session.h, wo dieselbe Reihenfolge aus demselben Grund steht.
#include "meeting_service_components/meeting_audio_interface.h"
#include "meeting_service_components/meeting_participants_ctrl_interface.h"
// GEMESSEN, KEINE eigene Falle: meeting_participants_ctrl_interface.h bindet
// diesen Header bereits selbst ein (Zeile 8 der SDK-Fassung), diese Zeile ist
// darum nur die explizite, unabhaengige Absicherung fuer diese
// Uebersetzungseinheit - derselbe Vorsichts-Stil wie bei windows.h oben.
#include "meeting_service_components/meeting_recording_interface.h"

USING_ZOOM_SDK_NAMESPACE

class AuthListener : public IAuthServiceEvent {
 public:
  void onAuthenticationReturn(AuthResult ret) override;
  void onLoginReturnWithReason(LOGINSTATUS, IAccountInfo*, LoginFailReason) override {}
  void onLogout() override {}
  void onZoomIdentityExpired() override {}
  void onZoomAuthIdentityExpired() override {}
  void onNotificationServiceStatus(SDKNotificationServiceStatus, SDKNotificationServiceError) override {}
};

/** Unsere Statusnamen. `other` ist ausdruecklich kein Verschlucken - der
 *  SDK-Rohwert geht in `raw` mit heraus. */
const char* statusName(MeetingStatus s);

class MeetingListener : public IMeetingServiceEvent {
 public:
  void onMeetingStatusChanged(MeetingStatus status, int iResult = 0) override;
  void onMeetingStatisticsWarningNotification(StatisticsWarningType) override {}
  void onMeetingParameterNotification(const MeetingParameter*) override {}
  void onSuspendParticipantsActivities() override {}
  void onAICompanionActiveChangeNotice(bool) override {}
  void onMeetingTopicChanged(const zchar_t*) override {}
  void onMeetingFullToWatchLiveStream(const zchar_t*) override {}
  void onUserNetworkStatusChanged(MeetingComponentType, ConnectionQuality, unsigned int, bool) override {}
  void onAppSignalPanelUpdated(IMeetingAppSignalHandler*) override {}
};

const char* roleName(UserRole r);
std::string participantJson(IUserInfo* u);

// ACHTUNG: REIN VIRTUELL, rund 30 Methoden, drei davon hinter #if defined(WIN32).
// Fehlt eine, bleibt die Klasse abstrakt. Steht eine zu viel drin, gibt es einen
// C2061 in einer fremden Zeile. `grep virtual` zeigt alle und verschluckt die
// Waechter - im Spike hat genau das einen Uebersetzungsfehler gekostet.
class ParticipantsListener : public IMeetingParticipantsCtrlEvent {
 public:
  void onUserJoin(IList<unsigned int>* lstUserID, const zchar_t* strUserList = nullptr) override;
  void onUserLeft(IList<unsigned int>* lstUserID, const zchar_t* strUserList = nullptr) override;
  void onUserNamesChanged(IList<unsigned int>* lstUserID) override;
  void onHostChangeNotification(unsigned int) override {}
  void onLowOrRaiseHandStatusChanged(bool, unsigned int) override {}
  void onCoHostChangeNotification(unsigned int, bool) override {}
  void onInvalidReclaimHostkey() override {}
  void onAllHandsLowered() override {}
  void onLocalRecordingStatusChanged(unsigned int, RecordingStatus) override {}
  void onAllowParticipantsRenameNotification(bool) override {}
  void onAllowParticipantsUnmuteSelfNotification(bool) override {}
  void onAllowParticipantsStartVideoNotification(bool) override {}
  void onAllowParticipantsShareWhiteBoardNotification(bool) override {}
  void onRequestLocalRecordingPrivilegeChanged(LocalRecordingRequestPrivilegeStatus) override {}
  void onAllowParticipantsRequestCloudRecording(bool) override {}
  void onInMeetingUserAvatarPathUpdated(unsigned int) override {}
  void onParticipantProfilePictureStatusChange(bool) override {}
  void onFocusModeStateChanged(bool) override {}
  void onFocusModeShareTypeChanged(FocusModeShareType) override {}
  void onBotAuthorizerRelationChanged(unsigned int) override {}
  void onVirtualNameTagStatusChanged(bool, unsigned int) override {}
  void onVirtualNameTagRosterInfoUpdated(unsigned int) override {}
  void onGrantCoOwnerPrivilegeChanged(bool) override {}
#if defined(WIN32)
  void onCreateCompanionRelation(unsigned int, unsigned int) override {}
  void onRemoveCompanionRelation(unsigned int) override {}
#endif
};

// ACHTUNG: onTranscodingStatusChanged gibt es NUR unter __linux__ - samt seinem
// Enum. Diese drei gibt es NUR unter WIN32. Im Spike gemessen, nicht vermutet.
// NIMMT das Merkzeichen "das Meeting ist zu Ende, die Abos gehoeren abgebaut"
// und LOESCHT es dabei (exchange). GEMESSEN am 18.08.2026: der Abbau DARF
// NICHT aus onMeetingStatusChanged heraus laufen - dort steckt das SDK
// mitten im eigenen Meeting-Abbau, und unSubscribe() auf einen Renderer
// beendete den Prozess mit STATUS_ACCESS_VIOLATION. main() ruft diese
// Funktion darum unmittelbar NACH pumpOnce() und baut dann ab: derselbe
// Durchlauf der Schleife, aber ausserhalb des Rueckrufs.
bool callbacksTakeMeetingEndTeardown();

class RecordingListener : public IMeetingRecordingCtrlEvent {
 public:
  void onRecordPrivilegeChanged(bool bCanRec) override;
  void onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus status) override;
  void onRecordingStatus(RecordingStatus) override {}
  void onCloudRecordingStatus(RecordingStatus) override {}
  void onRequestCloudRecordingResponse(RequestStartCloudRecordingStatus) override {}
  void onLocalRecordingPrivilegeRequested(IRequestLocalRecordingPrivilegeHandler*) override {}
  void onStartCloudRecordingRequested(IRequestStartCloudRecordingHandler*) override {}
  void onCloudRecordingStorageFull(time_t) override {}
  void onEnableAndStartSmartRecordingRequested(IRequestEnableAndStartSmartRecordingHandler*) override {}
  void onSmartRecordingEnableActionCallback(ISmartRecordingEnableActionHandler*) override {}
#if defined(WIN32)
  void onRecording2MP4Done(bool, int, const zchar_t*) override {}
  void onRecording2MP4Processing(int) override {}
  void onCustomizedLocalRecordingSourceNotification(ICustomizedLocalRecordingLayoutHelper*) override {}
#endif
};
