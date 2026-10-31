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
// Die drei Lauscher der Slots (Spec 6.5, Nachbesserung B43) - ERST NACH
// meeting_service_interface.h (oben): meeting_sharing_interface.h bindet nur
// zoom_sdk_def.h ein (meeting_sharing_interface.h:7), benutzt aber SDKViewType
// und SDKShareViewZoomRatio (:319, :327, :353), die erst in
// meeting_service_interface.h:620, :634 stehen - dieselbe Art Falle wie
// AudioType oben. meeting_audio_interface.h steht schon oben (Zeile mit der
// AudioType-Falle) und damit ebenfalls nach meeting_service_interface.h.
#include "meeting_service_components/meeting_sharing_interface.h"
#include "meeting_service_components/meeting_video_interface.h"
#include <cstdint>
#include <vector>

USING_ZOOM_SDK_NAMESPACE

// --- Merker der Slots (Spec 6.5, 6.6 Nr. 4; E21) ------------------------------------
// Jeder Rueckruf KOPIERT nur Werte (keine Zeiger, deren Lebensdauer der Header nicht
// nennt, etwa monitorID) in eine Warteschlange unter g_merkerMutex und kehrt zurueck.
// Die Hauptschleife nimmt sie nach pumpOnce(). Je Warteschlange hoechstens
// kMerkerMax Eintraege; was darueber kommt, zaehlt merkerVerworfen() (bridgeStats,
// T61). Auf welchem Thread die drei neuen Lauscher rufen, sagt kein Header
// (ANNAHME AN3, unbelegt) - die Warteschlange traegt beide Faelle.
constexpr size_t kMerkerMax = 1024;

/** Teilnehmer kam (beitritt) oder ging. Aus onUserJoin/onUserLeft. */
struct MerkerTeilnehmer { unsigned id = 0; bool beitritt = false; };
/** onUserVideoStatusChange: status = VideoStatus (Video_ON/OFF/Mute_ByHost). */
struct MerkerKamera { unsigned id = 0; int status = 0; };
/**
 * onSharingStatus (typNachtrag = false, status = SharingStatus) bzw.
 * onShareContentNotification (typNachtrag = true; was status dort traegt, sagt der
 * Header nicht, Spec 6.5 - darum ausdruecklich als Typ-Nachtrag gefuehrt).
 */
struct MerkerFreigabe { unsigned user = 0; unsigned share = 0; int status = 0; int contentType = 0; bool typNachtrag = false; };
/**
 * Sprecher-Signal: signal 0 = speakerVideo, 1 = activeVideo, 2 = activeAudio
 * (Reihenfolge von SPEAKER_SIGNALS bzw. slotlogic::Signal); qpc =
 * QueryPerformanceCounter im Rueckruf.
 */
struct MerkerSprecher { int signal = 0; std::vector<unsigned> ids; long long qpc = 0; };

/** INMEETING kam seit dem letzten Nehmen (nimmt und loescht, exchange). */
bool callbacksTakeInMeeting();
bool callbacksTakeTeilnehmer(MerkerTeilnehmer* out);
bool callbacksTakeKamera(MerkerKamera* out);
bool callbacksTakeFreigabe(MerkerFreigabe* out);
bool callbacksTakeSprecher(MerkerSprecher* out);
/** Uebergelaufene Merker seit Prozessstart (ein verlorenes Zoom-Ereignis je Zaehler). */
uint64_t merkerVerworfen();

/**
 * Renderer-Sperre (Spec 6.5, Nachbesserung B34): gesetzt im Rueckruf bei
 * DISCONNECTING und RECONNECTING (meeting_service_interface.h:28, :30), geloest
 * nur von der Hauptschleife (INMEETING-Merker oder Meeting-Ende-Kette). Jede
 * Renderer-Funktion liest sie vorher (ab Plan A, Aufgabe A14).
 */
bool callbacksRendererSperre();
void callbacksRendererSperreLoesen();
/**
 * Ob der zuletzt gemeldete Meeting-Status im Meeting ist (slotlogic::statusImMeeting; Nachtrag N2b.1): die
 * INMEETING-Kette loest die Renderer-Sperre nur dann (slotlogic::sperreLoesenErlaubt). Nur Hauptthread.
 */
bool callbacksStatusImMeeting();

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

// NIMMT das Merkzeichen "die Aufnahme-Erlaubnis ist entzogen, die Abos gehoeren
// abgebaut" und LOESCHT es dabei (exchange): true genau einmal je Entzug.
// Gesetzt in onRecordPrivilegeChanged(false), genommen in main() unmittelbar
// NACH pumpOnce() und nach dem Meeting-Ende-Abbau - aus demselben gemessenen
// Grund wie oben nie aus dem Rueckruf (Stage 4b, N4b.1).
bool callbacksTakePrivilegeRevokedTeardown();

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

// Freigabe-Lauscher (IMeetingShareCtrlEvent, 9 Methoden ohne #if, Signaturen
// woertlich aus meeting_sharing_interface.h:153-214). Wirkung Spec 6.5.
class ShareListener : public IMeetingShareCtrlEvent {
 public:
  void onSharingStatus(ZoomSDKSharingSourceInfo shareInfo) override;
  void onFailedToStartShare() override;
  void onLockShareStatus(bool /*bLocked*/) override {}
  void onShareContentNotification(ZoomSDKSharingSourceInfo shareInfo) override;
  void onMultiShareSwitchToSingleShareNeedConfirm(IShareSwitchMultiToSingleConfirmHandler* handler_) override;
  void onShareSettingTypeChangedNotification(ShareSettingType /*type*/) override {}
  void onSharedVideoEnded() override {}
  void onVideoFileSharePlayError(ZoomSDKVideoFileSharePlayError /*error*/) override {}
  void onOptimizingShareForVideoClipStatusChanged(ZoomSDKSharingSourceInfo /*shareInfo*/) override {}
};

// Video-Regler-Lauscher (IMeetingVideoCtrlEvent, 12 Methoden ohne #if,
// meeting_video_interface.h:208-290).
class VideoCtrlListener : public IMeetingVideoCtrlEvent {
 public:
  void onUserVideoStatusChange(unsigned int userId, VideoStatus status) override;
  void onSpotlightedUserListChangeNotification(IList<unsigned int >* /*lstSpotlightedUserID*/) override {}
  void onHostRequestStartVideo(IRequestStartVideoHandler* handler_) override;
  void onActiveSpeakerVideoUserChanged(unsigned int userid) override;
  void onActiveVideoUserChanged(unsigned int userid) override;
  void onHostVideoOrderUpdated(IList<unsigned int >* /*orderList*/) override {}
  void onLocalVideoOrderUpdated(IList<unsigned int >* /*localOrderList*/) override {}
  void onFollowHostVideoOrderChanged(bool /*bFollow*/) override {}
  void onUserVideoQualityChanged(VideoConnectionQuality /*quality*/, unsigned int /*userid*/) override {}
  void onVideoAlphaChannelStatusChanged(bool /*isAlphaModeOn*/) override {}
  void onCameraControlRequestReceived(unsigned int userId, CameraControlRequestType requestType, ICameraControlRequestHandler* pHandler) override;
  void onCameraControlRequestResult(unsigned int /*userId*/, CameraControlRequestResult /*result*/) override {}
};

// Ton-Regler-Lauscher (IMeetingAudioCtrlEvent, 5 Methoden ohne #if,
// meeting_audio_interface.h:108-143).
class AudioCtrlListener : public IMeetingAudioCtrlEvent {
 public:
  void onUserAudioStatusChange(IList<IUserAudioStatus* >* /*lstAudioStatusChange*/, const zchar_t* /*strAudioStatusList*/ = nullptr) override {}
  void onUserActiveAudioChange(IList<unsigned int >* plstActiveAudio) override;
  void onHostRequestStartAudio(IRequestStartAudioHandler* handler_) override;
  void onJoin3rdPartyTelephonyAudio(const zchar_t* /*audioInfo*/) override {}
  void onMuteOnEntryStatusChange(bool /*bEnabled*/) override {}
};
