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
// Muss VOR zoom_sdk.h stehen: zoom_sdk_def.h setzt HWND unter WIN32 als
// bereits bekannt voraus und typedef't es selbst nur im Nicht-WIN32-Zweig.
// Ohne diese Reihenfolge scheitert die Uebersetzung in zoom_sdk_def.h mit
// einer Kaskade aus C3646/C2065/C4430 - gemessen, siehe session.cpp, wo
// windows.h aus demselben Grund vor zoom_sdk.h steht.
#include <windows.h>
#include "zoom_sdk.h"
#include "auth_service_interface.h"
#include "meeting_service_interface.h"

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
