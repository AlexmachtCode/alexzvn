#include "session.h"
#include <atomic>
#include <climits>
#include <cstdlib>
#include <windows.h>
#include "zoom_sdk.h"
#include "meeting_service_interface.h"
#include "emit.h"
#include "callbacks.h"

USING_ZOOM_SDK_NAMESPACE

namespace {
bool g_sdkUp = false;
}

namespace {
IAuthService* g_auth = nullptr;
AuthListener g_authListener;
// Siehe sessionAuthPending() in session.h: schuetzt die asynchrone Antwort vor
// einem verfruehten Prozessende bei geschlossenem stdin.
bool g_authPending = false;

IMeetingService* g_meeting = nullptr;
MeetingListener g_meetingListener;
// Siehe sessionJoinPending() in session.h: derselbe Schutz wie g_authPending,
// nur fuer die ERSTE Statusmeldung eines Beitritts statt fuer die Anmeldung.
bool g_joinPending = false;

// Siehe sessionPrivilegePending() in session.h: derselbe Schutz wie
// g_authPending/g_joinPending, nur fuer RequestLocalRecordingPrivilege().
// g_recordingListener steht bewusst HIER (nicht in callbacks.cpp wie
// g_participantsListener) - checkPrivilege(), das ihn registriert, lebt in
// dieser Datei, siehe Brief Task 9.
RecordingListener g_recordingListener;
bool g_privilegePending = false;

// Merkzeichen fuer die Messstelle in sessionShutdown() (siehe dort und die
// Doc-Kommentare in session.h): haelt fest, ob JE ein Empfaenger auf dem
// jeweiligen Regler registriert wurde - unabhaengig davon, ob der
// Regler-Zeiger beim Abbau noch gueltig ist.
bool g_participantsListenerRegistered = false;
bool g_recordingListenerRegistered = false;

// Siehe sessionCanRecordRaw()/sessionSetCanRecordRaw() in session.h (Task 3):
// der ZULETZT gemeldete Stand der Rohdaten-Erlaubnis. Atomar, nicht bool -
// gesetzt wird auf dem SDK-Rueckruf-Thread (callbacks.cpp), gelesen beim
// Abo-Befehl (videoSubscribe(), video.cpp) auf dem Hauptthread.
std::atomic<bool> g_canRecordRaw{false};
// Ob StartRawRecording() in DIESEM Meeting bereits durchging. Nicht "nimmt der
// SDK Rohdaten entgegen" - das weiss nur der SDK -, sondern "wir haben den
// Schalter schon umgelegt". Wird beim Meeting-Ende zurueckgesetzt, sonst
// hielte ein zweites Meeting den Schalter faelschlich fuer bereits gelegt.
std::atomic<bool> g_rawRecordingOn{false};
}  // namespace

// NICHT (mehr) TU-lokal: session.h erklaert diese Funktion oeffentlich, main.cpp
// braucht sie fuer Punkt F der Abschluss-Sichtung (unbekannter Befehl auf
// stderr statt unmaskiert in JSON). War vorher in der anonymen Namespace hier
// oben, unveraendert in der Umsetzung - nur die Sichtbarkeit ist neu.
std::wstring toWide(const std::string& utf8) {
  const int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(need), L'\0');
  if (need > 0) {
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), w.data(), need);
  }
  return w;
}

void pumpOnce() {
  MSG msg;
  while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
}

bool sessionInit() {
  if (g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":2}");  // SDKERR_WRONG_USAGE
    return false;
  }

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  // Muss stehen, BEVOR Rohdaten fliessen (Stage 2/3). Hier schadet es nicht.
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  // ACHTUNG: OHNE DIESE ZEILE HAENGT DER BEITRITT BEI CONNECTING.
  // Vorgabe ist der Zoom-UI-Modus: das SDK will ein eigenes Meeting-FENSTER
  // aufmachen. Die Bridge hat keines. Der Beitritt scheitert dann nicht - er
  // haengt, und das sieht aus wie ein Netzwerkproblem. Im Stage-0-Spike gemessen:
  // 90 Sekunden Schweigen bei CONNECTING.
  p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;

  const SDKError err = InitSDK(p);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    emitLog(L"InitSDK fehlgeschlagen.");
    return false;
  }
  g_sdkUp = true;

  const zchar_t* v = GetSDKVersion();
  emitRaw(std::string("{\"ev\":\"ready\",\"sdkVersion\":\"") + jsonEscape(v ? v : L"(unbekannt)") + "\"}");
  return true;
}

void sessionAuth(const std::string& jwtUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_auth == nullptr) {
    const SDKError err = CreateAuthService(&g_auth);
    if (err != SDKERR_SUCCESS || g_auth == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_auth->SetEvent(&g_authListener);
  }

  // Das JWT lebt nur bis zum Ende dieses Aufrufs und wird nie ausgegeben.
  const std::wstring jwt = toWide(jwtUtf8);
  AuthContext ctx;
  ctx.jwt_token = jwt.c_str();
  const SDKError err = g_auth->SDKAuth(ctx);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    return;
  }
  // Bei Erfolg wird hier NICHTS gemeldet: die Antwort kommt asynchron.
  // Bis onAuthenticationReturn feuert (sessionAuthAnswered()), gilt die
  // Anmeldung als offen - siehe sessionAuthPending().
  g_authPending = true;
}

bool sessionAuthPending() {
  return g_authPending;
}

void sessionAuthAnswered() {
  g_authPending = false;
}

void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_meeting == nullptr) {
    const SDKError err = CreateMeetingService(&g_meeting);
    if (err != SDKERR_SUCCESS || g_meeting == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_meeting->SetEvent(&g_meetingListener);
  }

  const UINT64 number = _strtoui64(meetingIdUtf8.c_str(), nullptr, 10);
  if (number == 0) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
    return;
  }

  const std::wstring name = toWide(displayNameUtf8);
  const std::wstring psw = toWide(passcodeUtf8);

  JoinParam jp;
  jp.userType = SDK_UT_WITHOUT_LOGIN;
  JoinParam4WithoutLogin& w = jp.param.withoutloginuserJoin;
  w.meetingNumber = number;
  w.userName = name.c_str();
  w.psw = psw.empty() ? nullptr : psw.c_str();
  // Die Bridge sendet NICHTS. Sie hoert nur zu.
  w.isVideoOff = true;
  w.isAudioOff = true;

  const SDKError err = g_meeting->Join(jp);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    return;
  }
  // Bei Erfolg NICHTS melden: das Ergebnis kommt als Statusfolge.
  // Ab hier gilt der Beitritt als offen, bis die ERSTE Statusmeldung eintrifft
  // (sessionJoinAnswered(), von MeetingListener::onMeetingStatusChanged gerufen)
  // - siehe sessionJoinPending() in session.h. Derselbe Verschluck-Mechanismus
  // wie bei sessionAuth(): ohne diese Markierung koennte EOF den Beitritt
  // beenden, bevor auch nur eine Pumprunde eine Rueckmeldung bringt.
  g_joinPending = true;
}

bool sessionLeave() {
  // GANZ OBEN, VOR jedem Ruecksprung (Abschluss-Sichtung, M2): wer diese
  // Funktion ruft, verlaesst das Meeting - ab hier gilt keine Erlaubnis mehr,
  // die in DIESEM Meeting erteilt wurde. Vorher blieb g_canRecordRaw ueber
  // ein "leave" hinweg auf true stehen und galt im naechsten Meeting weiter:
  // ein "ja" ohne Deckung. Hier und nicht an den drei Ruecksprungstellen
  // einzeln - eine Vorbedingung, die an jedem Ausgang wiederholt werden
  // muss, wird beim naechsten neuen Ausgang vergessen.
  sessionClearCanRecordRaw();
  if (g_meeting == nullptr) return true;  // kein Meeting -> trivial ruhend, nichts zu tun

  // ACHTUNG, GEMESSEN: der Befehl "leave" ruft diese Funktion auf, OHNE
  // g_meeting auf nullptr zu setzen oder den Dienst zu zerstoeren - ein
  // spaeteres "quit" ruft sessionLeave() dadurch ein zweites Mal auf demselben
  // Dienst auf (sessionShutdown()). Ein zweiter SDK-Ruf auf ein Meeting, das
  // BEREITS in ENDED/IDLE steht, liefert zuverlaessig SDKERR_WRONG_USAGE
  // (code 2) - GLEICH AUF WELCHEM WEG dieser Zustand erreicht wurde: durch
  // unseren eigenen Leave()-Ruf, durch den Gastgeber, der das Meeting fuer
  // alle beendet, oder durch einen asynchron gescheiterten Beitritt. Eine
  // Fehlerzeile bei JEDEM dieser alltaeglichen Ausgaenge entwertet die Regel
  // "kein SDKError wird verworfen", die echte Fehler sichtbar halten soll -
  // eine Anzeige, die immer da ist, wird nicht gelesen.
  //
  // Ein vorheriger Entwurf hielt sich das mit einem eigenen Merkzeichen
  // (g_meetingLeft), das nur "ICH habe sauber verlassen" abdeckte - nicht
  // "das Meeting ist ohnehin vorbei" (Gastgeber beendet fuer alle,
  // gescheiterter Beitritt). GEMESSEN deckte das Merkzeichen daher nur die
  // HAELFTE der alltaeglichen Ausgaenge ab. Ersetzt durch die Zustandsfrage,
  // die das SDK selbst beantwortet - EINE Wahrheitsquelle statt zweier, die
  // auseinanderlaufen koennen, und sie deckt jeden Fall des Merkzeichens plus
  // die beiden, die es nicht konnte.
  const MeetingStatus statusOnEntry = g_meeting->GetMeetingStatus();
  if (statusOnEntry == MEETING_STATUS_ENDED || statusOnEntry == MEETING_STATUS_IDLE) {
    // Das Meeting steht BEREITS auf ENDED/IDLE - Leave() waere per Definition
    // ueberfluessig, unabhaengig vom Grund. SDK-Aufruf UND Pumpschleife
    // entfallen, kein Fehler wird gemeldet. NICHT: "spart einen Aufruf".
    // SONDERN: verhindert eine Fehlermeldung fuer einen Zustand, der bereits
    // erreicht ist.
    //
    // Zur Pumpschleife weiter unten: sie existiert NUR, damit
    // DestroyMeetingService (siehe sessionShutdown()) nicht waehrend
    // CONNECTING laeuft - das hat den Stage-0-Spike mit 0xC0000005 beendet.
    // Sie wartet auf GENAU die Bedingung, die hier bereits erfuellt ist
    // (ENDED/IDLE) - das Ueberspringen hier ist dieselbe Abbruchbedingung,
    // keine neue.
    //
    // ACHTUNG, WARUM GENAU ENDED/IDLE UND NICHT AUCH FAILED: FAILED sieht wie
    // ein Endzustand aus, ist aber KEINER. Gemessen wurde die Folge
    // connecting -> disconnecting -> failed -> ended: nach FAILED arbeitet der
    // SDK-Thread WEITER, bis ENDED steht. Wer FAILED hier aufnaehme, wuerde die
    // Pumpschleife MITTEN in dieser Abwicklung ueberspringen - genau diese Lage
    // laesst DestroyMeetingService mit 0xC0000005 abstuerzen. In dieser Aufgabe
    // einmal versehentlich hergestellt (die Pumpfrist unten wurde zu Messzwecken
    // auf 5 ms verkuerzt, wodurch der Abbau ebenfalls waehrend DISCONNECTING
    // lief) und 5/5 reproduziert. Diese Bedingung darf deshalb nur um Zustaende
    // wachsen, die nachweislich RUHEN - nicht um solche, die bloss endgueltig
    // KLINGEN. Der Preis dafuer ist gering: steht wirklich einmal FAILED an,
    // laeuft ein ueberfluessiger Leave()-Ruf ins Leere und meldet code 2, und
    // die Pumpschleife wartet danach sicher bis ENDED.
    return true;  // bereits ruhend
  }

  // ACHTUNG: kein SDKError wird verworfen (bindende Randbedingung des Plans) -
  // der woertliche Brief-Codeblock tat das an dieser Stelle, das war ein
  // Fehler im Brief, nicht in der Randbedingung. Ein gescheitertes Leave() ist
  // ein Grund, MEHR aufzupassen, nicht ein Grund, den Abbau zu ueberspringen:
  // gemeldet wird es, TROTZDEM wird unten weiter gepumpt und regulaer
  // abgebaut - ein uebersprungener Abbau ist genau der Fehler, der den
  // Stage-0-Spike mit 0xC0000005 beendet hat.
  const SDKError leaveErr = g_meeting->Leave(LEAVE_MEETING);
  if (leaveErr != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"leave\",\"code\":" + std::to_string(static_cast<int>(leaveErr)) + "}");
    emitLog(std::wstring(L"Leave() fehlgeschlagen, SDKError=") + std::to_wstring(static_cast<int>(leaveErr)) +
            L" - der Abbau laeuft trotzdem weiter.");
  }

  // Erst SAUBER VERLASSEN, dann abbauen - bis zu 5 s pumpen. Ein
  // DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
  // 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
  // noch arbeitet.
  const ULONGLONG deadline = GetTickCount64() + 5000;
  MeetingStatus lastStatus = g_meeting->GetMeetingStatus();
  while (GetTickCount64() < deadline) {
    pumpOnce();
    lastStatus = g_meeting->GetMeetingStatus();
    if (lastStatus == MEETING_STATUS_ENDED || lastStatus == MEETING_STATUS_IDLE) break;
    Sleep(20);
  }

  if (lastStatus != MEETING_STATUS_ENDED && lastStatus != MEETING_STATUS_IDLE) {
    // ACHTUNG, GEMESSEN AN ANDERER STELLE (Stage-0-Spike, 90 s Schweigen bei
    // CONNECTING): eine Wartefrist darf nicht stillschweigend ablaufen. Der
    // zuletzt gesehene Status geht als "lastStatus" mit - derselbe Feldname,
    // den bridge.ts (Task 10) fuer ihren eigenen "joinTimeout" schon benutzt -
    // damit spaeter nachvollziehbar ist, WORAUF vergeblich gewartet wurde.
    // Die Frist ist eine OBERGRENZE, kein Abbruchkriterium: der Aufrufer
    // (sessionShutdown()) baut danach TROTZDEM ab, unveraendert. Der naechste
    // sessionLeave()-Aufruf fragt beim Eintritt erneut GetMeetingStatus() ab
    // (siehe oben) und versucht Leave() zu Recht noch einmal, weil der Status
    // hier NICHT auf ENDED/IDLE steht.
    emitRaw(std::string("{\"ev\":\"error\",\"where\":\"leave\",\"code\":\"leaveTimeout\",\"lastStatus\":\"") +
            statusName(lastStatus) + "\"}");
    // ACHTUNG, GEAENDERT (Owner-Entscheidung, Abschluss-Sichtung Punkt A): der
    // Kommentar "der Abbau laeuft trotzdem weiter" beschrieb den Stand VOR
    // dieser Entscheidung - sessionShutdown() zerstoert in diesem Fall JETZT
    // NICHT mehr, siehe dort. Diese Zeile bleibt trotzdem die letzte
    // verwertbare Information vor einem moeglichen TerminateProcess: sie
    // steht auf stdout UND stderr, bevor sessionLeave() zurueckkehrt.
    emitLog(std::wstring(L"Zeitueberschreitung: 5 s Leave-Pumpobergrenze abgelaufen, zuletzt gesehener Status: ") +
            toWide(std::string(statusName(lastStatus))) + L" - der SDK-Thread arbeitet nachweislich noch, der "
            L"Abbau (DestroyMeetingService/DestroyAuthService/CleanUPSDK) wird UEBERSPRUNGEN.");
    return false;  // NICHT ruhend - sessionShutdown() darf jetzt nicht zerstoeren
  }
  return true;  // die Pumpschleife hat ENDED/IDLE erreicht, bevor die Frist ablief
}

bool sessionJoinPending() {
  return g_joinPending;
}

void sessionJoinAnswered() {
  g_joinPending = false;
}

IMeetingParticipantsController* participantsCtrl() {
  return g_meeting ? g_meeting->GetMeetingParticipantsController() : nullptr;
}

void emitRoster() {
  IMeetingParticipantsController* ctrl = participantsCtrl();
  if (ctrl == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"roster\",\"code\":31}");  // SDKERR_NOT_IN_MEETING
    return;
  }
  IList<unsigned int>* ids = ctrl->GetParticipantsList();
  std::string out = "{\"ev\":\"roster\",\"list\":[";
  bool first = true;
  for (int i = 0; ids != nullptr && i < ids->GetCount(); ++i) {
    const std::string p = participantJson(ctrl->GetUserByUserID(ids->GetItem(i)));
    if (p.empty()) continue;
    if (!first) out += ",";
    out += p;
    first = false;
  }
  out += "]}";
  emitRaw(out);
}

void markParticipantsListenerRegistered() {
  g_participantsListenerRegistered = true;
}

bool sessionFindParticipant(unsigned int userId, std::wstring* nameOut, std::string* persistentIdOut) {
  IMeetingParticipantsController* ctrl = participantsCtrl();
  if (ctrl == nullptr) return false;  // kein Meeting - nicht "leerer Name als Erfolg"
  IUserInfo* u = ctrl->GetUserByUserID(userId);
  if (u == nullptr) return false;  // Kennung nicht (mehr) in der Teilnehmerliste
  const zchar_t* name = u->GetUserName();
  const zchar_t* pid = u->GetPersistentId();
  if (nameOut != nullptr) *nameOut = name ? name : L"";
  // persistentId kann LEER sein (nicht angemeldete Gaeste) - das ist ein
  // gueltiges Ergebnis, kein Fehlschlag. toUtf8() aus emit.h (Task 3).
  if (persistentIdOut != nullptr) *persistentIdOut = toUtf8(pid ? pid : L"");
  return true;
}

IMeetingRecordingController* recordingCtrl() {
  return g_meeting ? g_meeting->GetMeetingRecordingController() : nullptr;
}

void checkPrivilege() {
  // ACHTUNG, ZURUECKGENOMMEN (Nachbesserung 2): hier stand einmal ein
  // unbedingtes `g_privilegePending = false;` als ALLERERSTE Anweisung der
  // Funktion, das JEDEN Ruecksprungpfad abdeckte - auch die beiden
  // Fehlerfaelle ganz am Anfang und die beiden Fehlerfaelle bei
  // IsSupportRequestLocalRecordingPrivilege()/RequestLocalRecordingPrivilege().
  // Das loeste Befund C (Nachbesserung 1: das Merkzeichen einer laengst
  // beantworteten Anfrage blieb im Sofort-Erfolgspfad haengen) VOLLSTAENDIG,
  // riss dabei aber die GEGENRICHTUNG auf: checkPrivilege() laeuft bei JEDEM
  // Erreichen von INMEETING, ausdruecklich auch nach einer Wiederverbindung
  // (siehe der Kommentar in callbacks.cpp). Ist zu diesem Zeitpunkt eine
  // ERSTE, echte RequestLocalRecordingPrivilege()-Anfrage noch offen und
  // dieser zweite Aufruf nimmt einen der frueheren Ruecksprungpfade (z.B.
  // rec == nullptr bei instabilem Regler-Zeiger waehrend des Reconnects),
  // wuerde das Merkzeichen der ERSTEN Anfrage geloescht, OHNE dass deren
  // Antwort je eingetroffen ist - faellt EOF in dieses Fenster, verschwindet
  // eine echte Antwort SPURLOS.
  //
  // Die beiden Fehlrichtungen sind NICHT gleichwertig: bleibt das
  // Merkzeichen faelschlich stehen, wartet der Prozess hoechstens 10 s und
  // meldet dann sichtbar einen irrefuehrenden privilegeEofTimeout - sichtbar
  // und begrenzt. Wird es faelschlich geloescht, verschwindet eine echte
  // Antwort unsichtbar und unbegrenzt. Dieselbe Rangordnung wie in
  // readStdin() (main.cpp): ein verschluckter Befehl ist schlimmer als ein
  // abgewiesener - hier: eine verschluckte Antwort ist schlimmer als eine
  // ueberfluessige Zeitueberschreitungsmeldung. Deshalb steht das
  // Zuruecksetzen NICHT mehr pauschal hier oben, sondern NUR an der einen
  // Stelle unten (Sofort-Erfolg), an der diese Funktion POSITIV WEISS, dass
  // keine Antwort mehr aussteht - eine bereits gewaehrte Erlaubnis macht jede
  // fruehere Anfrage gegenstandslos, GLEICH OB sie von diesem oder einem
  // vorigen Aufruf stammt. Alle anderen Ruecksprungpfade unten sagen ueber
  // eine moeglicherweise laufende FRUEHERE Anfrage NICHTS aus und lassen das
  // Merkzeichen darum unangetastet - stand es auf false, bleibt es false,
  // nichts wird durch diese Aenderung schlechter als vor Befund C.
  //
  // NICHT GEMESSEN und nicht behauptet: ob das SDK eine nach einem Reconnect
  // verwaiste Anfrage ueberhaupt noch beantwortet oder sie selbst intern
  // verwirft - aus den Kopfdateien nicht zu klaeren, ohne echtes Meeting
  // nicht zu messen. Diese Fassung waehlt bewusst die Richtung, deren
  // Fehlerfall SICHTBAR bleibt (ein begrenztes, meldendes Warten), nicht die
  // Richtung, die den Fall vollstaendig zu loesen behauptet.

  if (g_meeting == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":31}");  // SDKERR_NOT_IN_MEETING
    return;
  }
  IMeetingRecordingController* rec = g_meeting->GetMeetingRecordingController();
  if (rec == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":6}");  // SDKERR_SERVICE_FAILED
    return;
  }
  rec->SetEvent(&g_recordingListener);
  // Haelt fest, dass JE ein Empfaenger auf dem Aufnahme-Regler stand - siehe
  // die Messstelle in sessionShutdown(), die genau dieses Merkzeichen braucht,
  // um ein stilles Uebergehen der Abmeldung SICHTBAR zu machen.
  g_recordingListenerRegistered = true;

  const SDKError can = rec->CanStartRawRecording();
  if (can == SDKERR_SUCCESS) {
    // Synchrone Sofortpruefung - eine ANDERE Ursache als ein unaufgeforderter
    // Rundruf (broadcast, siehe onRecordPrivilegeChanged) oder eine Antwort
    // auf ein GESUCH (requestAnswer, siehe onLocalRecordingPrivilegeRequestStatus):
    // hier wurde noch gar nicht gefragt. "source" unterscheidet die drei
    // Ursachen (Nachbesserung 1, Owner-Entscheidung: Befund A).
    //
    // Zuruecksetzen HIER, nicht pauschal am Funktionsanfang (siehe der lange
    // Kommentar oben, Nachbesserung 2): DIESE Zeile ist der einzige Ort, an
    // dem checkPrivilege() POSITIV WEISS, dass keine Antwort mehr aussteht -
    // die Erlaubnis ist JETZT gewaehrt, eine etwaige aeltere, noch offene
    // Anfrage ist damit gegenstandslos, GLEICH OB die Antwort auf sie je
    // eintrifft.
    g_privilegePending = false;
    // Melde-Stelle 1/5 (Task 3): siehe sessionSetCanRecordRaw() in session.h.
    sessionSetCanRecordRaw(true);
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":true,\"source\":\"check\"}");
    return;
  }

  const SDKError sup = rec->IsSupportRequestLocalRecordingPrivilege();
  if (sup != SDKERR_SUCCESS) {
    // Meist: im Zoom-Portal ist die lokale Aufzeichnung nicht freigegeben.
    // Das ist ein anderer Fall als "abgelehnt" und bekommt deshalb seinen
    // eigenen Fehler statt eines privilege-Ereignisses.
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":" + std::to_string(static_cast<int>(sup)) + "}");
    return;
  }

  const SDKError req = rec->RequestLocalRecordingPrivilege();
  if (req != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":" + std::to_string(static_cast<int>(req)) + "}");
    return;
  }
  // Ab hier gilt die Anfrage als offen, bis onLocalRecordingPrivilegeRequestStatus
  // antwortet (sessionPrivilegeAnswered()) - derselbe Verschluck-Mechanismus wie
  // bei sessionAuth()/sessionJoin(): ohne diese Markierung koennte EOF die Antwort
  // verschlucken, bevor sie eintrifft (siehe sessionPrivilegePending() in session.h).
  g_privilegePending = true;
  // Steht beim Gastgeber IsAutoAllowLocalRecordingRequest() auf an, kommt die
  // Freigabe in Millisekunden zurueck - ohne dass jemand klicken muss. Diese
  // Zeile ist VORUEBERGEHEND ("requested", Antwort steht noch aus) - im
  // Unterschied zur ENDGUELTIGEN Timeout-Zeile oben in callbacks.cpp
  // ("requested" UND "timedOut") waren beide vorher byte-gleich.
  emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"source\":\"check\",\"requested\":true}");
}

bool sessionPrivilegePending() {
  return g_privilegePending;
}

void sessionPrivilegeAnswered() {
  g_privilegePending = false;
}

bool sessionCanRecordRaw() {
  return g_canRecordRaw;
}

void sessionSetCanRecordRaw(bool v) {
  g_canRecordRaw = v;
}

SDKError sessionStartRawRecording() {
  // EINMAL je Meeting, nicht je Abo. Der zweite Aufruf waere kein Fehler,
  // aber ein zweiter Rueckgabewert, den niemand mehr auseinanderhalten kann.
  if (g_rawRecordingOn) return SDKERR_SUCCESS;
  IMeetingRecordingController* rec = recordingCtrl();
  if (rec == nullptr) return SDKERR_SERVICE_FAILED;
  const SDKError err = rec->StartRawRecording();
  if (err == SDKERR_SUCCESS) g_rawRecordingOn = true;
  return err;
}

void sessionClearRawRecording() {
  g_rawRecordingOn = false;
}

void sessionClearCanRecordRaw() {
  // EIGENE Funktion statt sessionSetCanRecordRaw(false) (Abschluss-Sichtung,
  // M2): der Doc-Kommentar dort bindet jeden Aufruf an eine Melde-Stelle -
  // "das Meeting ist vorbei" ist keine. Zwei verschiedene Anlaesse, zwei
  // verschiedene Namen; wer spaeter die Melde-Stellen zaehlt, findet hier
  // keine sechste, die keine ist.
  g_canRecordRaw = false;
}

bool sessionShutdown() {
  if (!g_sdkUp) return true;
  // Owner-Entscheidung, Abschluss-Sichtung Punkt A: bleibt WAHR, solange kein
  // Grund gemessen ist, den Abbau abzubrechen. Wird FALSCH, wenn
  // sessionLeave() unten meldet, dass die 5-s-Pumpobergrenze abgelaufen ist,
  // WAEHREND der SDK-Thread nachweislich noch arbeitet - siehe die
  // ausfuehrliche Begruendung an sessionLeave()s Doc-Kommentar (session.h)
  // und main.cpp (Prozessende). Ohne Meeting (g_meeting == nullptr) bleibt es
  // WAHR: es gibt nichts, dessen Abbau abbrechen koennte.
  bool leaveSettled = true;
  if (g_meeting != nullptr) {
    leaveSettled = sessionLeave();
    // Abmeldung NACH sessionLeave(), nicht davor: sessionLeave() pumpt bis zu
    // 5 s auf ENDED/IDLE, und waehrend dieses Pumpens duerfen Teilnehmer-
    // Rueckrufe noch feuern (Leute verlassen das Meeting, waehrend es endet)
    // - das sind gueltige Tatsachen, die gemeldet gehoeren. Erst wenn
    // sessionLeave() zurueckkehrt, wird der Empfaenger abgemeldet, symmetrisch
    // zu g_meeting->SetEvent(nullptr) und g_auth->SetEvent(nullptr) unten -
    // ein registrierter Empfaenger wird IMMER abgemeldet, bevor der
    // zugehoerige Dienst zerstoert wird, nicht "sofern sonst nichts mehr
    // kommt".
    //
    // MESSSTELLE (Task 9): die SDK-Kopfdateien dokumentieren NICHT, ob
    // GetMeetingParticipantsController()/GetMeetingRecordingController() nach
    // einem wirklich durchlaufenen INMEETING -> Leave() noch denselben
    // gueltigen Zeiger liefern oder bereits nullptr. Liefert einer von beiden
    // hier nullptr, wuerde die Abmeldung STILL uebersprungen - genau der
    // interessante Fall, in dem es am meisten zaehlt. g_..ListenerRegistered
    // haelt fest, ob JE registriert wurde; steht das Merkzeichen, der
    // Regler-Zeiger ist aber nullptr, wird das auf stderr gemeldet (Diagnose
    // fuer den Bediener, keine Protokolltatsache) - das ist KEIN Fehlerfall,
    // den diese Aufgabe erfindet, sondern eine Messstelle fuer eine Frage, die
    // aus den Kopfdateien nicht hervorgeht. Schlaegt sie nie an, ist die Frage
    // beantwortet (der Zeiger bleibt gueltig); schlaegt sie an, ebenso (er
    // wird nullptr, und die Abmeldung wird bewusst uebersprungen statt auf
    // einem nullptr SetEvent() zu rufen). NICHT GEMESSEN (kein echtes Meeting
    // verfuegbar ohne Owner-Freigabe): welchen der beiden Faelle ein echter
    // SDK-Lauf zeigt.
    IMeetingParticipantsController* pctrl = participantsCtrl();
    if (pctrl != nullptr) {
      pctrl->SetEvent(nullptr);
    } else if (g_participantsListenerRegistered) {
      emitLog(L"Messstelle: Teilnehmer-Regler war registriert, ist beim Abbau aber "
              L"nullptr - die SDK-Kopfdateien klaeren nicht, ob GetMeetingParticipantsController() "
              L"nach Leave() noch gueltig bleibt. Abmeldung uebersprungen, kein Absturz.");
    }
    IMeetingRecordingController* rctrl = recordingCtrl();
    if (rctrl != nullptr) {
      rctrl->SetEvent(nullptr);
    } else if (g_recordingListenerRegistered) {
      emitLog(L"Messstelle: Aufnahme-Regler war registriert, ist beim Abbau aber "
              L"nullptr - dieselbe offene Frage wie beim Teilnehmer-Regler oben, hier "
              L"fuer GetMeetingRecordingController(). Abmeldung uebersprungen, kein Absturz.");
    }
    // g_meeting->SetEvent(nullptr) laeuft IMMER, auch wenn leaveSettled unten
    // false ist - GEMESSEN (Abschluss-Sichtung Punkt A, siehe
    // final-fix-report.md fuer die woertlichen Laeufe): in genau diesem
    // Zustand (kuenstlich verkuerzte Pumpobergrenze, SDK-Thread nachweislich
    // noch aktiv) endete der Prozess in Aufgabe 7 GEMESSEN 5/5 mit
    // 0xC0000005 - NACHGERECHNET (Schluss-Pruefung dieser Runde) auf dem
    // REGULAEREN Ausstiegsweg NACH einem bereits gesendeten "bye", NICHT
    // nachweislich in DestroyMeetingService selbst. Dieselbe Messreihe mit
    // genau diesem SetEvent(nullptr) an Ort und Stelle (Destroy weiterhin
    // uebersprungen, Ausstieg jetzt ueber TerminateProcess statt "bye")
    // wiederholt: 10/10 kein Absturz. SetEvent() tauscht nur den
    // registrierten Empfaenger-Zeiger aus, es zerstoert kein Objekt und
    // raeumt keinen Zustand weg, an dem der SDK-Thread noch arbeitet - eine
    // PLAUSIBLE, nicht eine selbststaendig GEMESSENE Begruendung, warum es
    // hier bleibt und Destroy nicht. Bewusst symmetrisch zu den beiden
    // Reglern oben: ein registrierter Empfaenger wird IMMER abgemeldet,
    // unabhaengig davon, ob der zugehoerige Dienst in diesem Lauf noch
    // zerstoert wird.
    g_meeting->SetEvent(nullptr);
    if (leaveSettled) {
      DestroyMeetingService(g_meeting);
      g_meeting = nullptr;
    }
    // ACHTUNG, ABSICHTLICH KEIN "else": bleibt leaveSettled false, bleibt
    // g_meeting bewusst am Leben (nicht auf nullptr gesetzt, nicht zerstoert)
    // - ein DestroyMeetingService-Aufruf waehrend eines NICHT-ruhenden
    // Zustands ist GENAU die Lage, in der der Prozess in Aufgabe 7 GEMESSEN
    // 5/5 mit 0xC0000005 endete (nicht nachweislich IN DestroyMeetingService
    // selbst, siehe oben - der Abbau wird hier als Vorsichtsmassnahme
    // uebersprungen, nicht weil DestroyMeetingService selbst als Ursache
    // belegt waere). main() beendet den Prozess in diesem Fall ueber
    // TerminateProcess (siehe dort, GEMESSEN 10/10 ohne Absturz), das
    // ueberspringt DLL_PROCESS_DETACH fuer ALLE angehaengten DLLs - der halb
    // abgebaute Zustand hier wird darum nie sichtbar nachgefragt.
  }
  if (g_auth != nullptr) {
    // Derselbe Grund wie oben: SetEvent(nullptr) zerstoert nichts, bleibt
    // darum unbedingt. Der Auth-Dienst haengt nicht am Meeting-Zustand - ihn
    // trotzdem stehenzulassen waere eine unbegruendete Annahme; er wird nur
    // dann NICHT zerstoert, wenn der Meeting-Abbau oben bereits abgebrochen
    // wurde (Owner-Vorgabe: DestroyAuthService gehoert zu den drei
    // uebersprungenen Aufrufen).
    g_auth->SetEvent(nullptr);
    if (leaveSettled) {
      DestroyAuthService(g_auth);
      g_auth = nullptr;
    }
  }
  if (leaveSettled) {
    CleanUPSDK();
    g_sdkUp = false;
  }
  return leaveSettled;
}

namespace {

bool isJsonSpace(char c) { return c == ' ' || c == '\t'; }

// Liest den Zeichenkettenwert, der bei "at" (dem oeffnenden Anfuehrungszeichen)
// beginnt, mit denselben Maskierungsregeln wie der Rest des Lesers.
std::string readStringValue(const std::string& line, size_t at) {
  std::string out;
  size_t i = at + 1;
  while (i < line.size()) {
    const char c = line[i];
    if (c == '\\' && i + 1 < line.size()) {
      const char n = line[i + 1];
      switch (n) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        default:  out += n;    break;  // \" \\ \/ und alles andere woertlich
      }
      i += 2;
      continue;
    }
    if (c == '"') break;
    out += c;
    ++i;
  }
  return out;
}

// Liest eine Ziffernfolge, die bei "at" beginnt (der Aufrufer hat dort
// bereits mindestens eine Ziffer gesehen). *endOut zeigt hinter die letzte
// gelesene Ziffer. *overflow wird wahr, wenn die Folge unsigned long long
// gesprengt hat - dieselbe Sorgfalt wie beim std::stoul-try/catch-Fix in
// main.cpp (Task 3): eine durch Ueberlauf VERSTUEMMELTE Zahl waere schlimmer
// als ein klar gemeldetes "nicht auswertbar". Kein Maskierungsschritt noetig
// (anders als readStringValue() oben) - Ziffern sind Ziffern.
unsigned long long readUnsignedDigits(const std::string& line, size_t at, size_t* endOut, bool* overflow) {
  unsigned long long value = 0;
  *overflow = false;
  size_t i = at;
  while (i < line.size() && line[i] >= '0' && line[i] <= '9') {
    const unsigned long long digit = static_cast<unsigned long long>(line[i] - '0');
    if (!*overflow) {
      // ULLONG_MAX statt std::numeric_limits<...>::max(): windows.h (siehe
      // Include oben) definiert ohne NOMINMAX ein Makro `max` - das haette
      // den STL-Aufruf hier zu einem funktionsartigen Makroaufruf verstuemmelt
      // (GEMESSEN: "zu wenige Argumente fuer das Makro" beim ersten
      // Bauversuch dieser Nachbesserung).
      if (value > (ULLONG_MAX - digit) / 10) {
        *overflow = true;
      } else {
        value = value * 10 + digit;
      }
    }
    ++i;
  }
  *endOut = i;
  return value;
}

}  // namespace

std::string fieldFromJson(const std::string& line, const char* key) {
  // Der Leser bleibt bewusst schlicht: ausschliesslich flache
  // Zeichenkettenfelder (siehe session.h - BERICHTIGT, Nachbesserungsrunde 1:
  // "id" bei videoSubscribe/videoUnsubscribe ist eine ZAHL, dafuer steht
  // numberFromJson() weiter unten). Er sucht daher NICHT nach einem
  // Baum, sondern nach der Zeichenfolge des Schluessels und prueft an dieser
  // Stelle nur zwei Dinge nach: steht unmittelbar davor ein '{' oder ein ','
  // (also eine SCHLUESSEL-Position, keine WERT-Position), und folgt nach dem
  // Doppelpunkt wieder ein Anfuehrungszeichen (also ein STRING-Wert, keine
  // Zahl, kein Objekt, kein Array)? Beides muss stimmen, sonst gilt das Feld
  // als nicht gefunden - das ist fuer dieses Protokoll richtig, waere aber
  // falsch fuer allgemeines JSON (verschachtelte Objekte, Zahlenfelder,
  // Arrays erkennt dieser Leser gar nicht und soll er auch nicht).
  const std::string needle = std::string("\"") + key + "\"";
  size_t searchFrom = 0;

  while (true) {
    size_t at = line.find(needle, searchFrom);
    if (at == std::string::npos) return "";

    bool isKeyPosition = false;
    size_t p = at;
    while (p > 0 && isJsonSpace(line[p - 1])) --p;
    if (p > 0 && (line[p - 1] == '{' || line[p - 1] == ',')) isKeyPosition = true;

    if (isKeyPosition) {
      size_t after = at + needle.size();
      while (after < line.size() && isJsonSpace(line[after])) ++after;
      if (after < line.size() && line[after] == ':') {
        ++after;
        while (after < line.size() && isJsonSpace(line[after])) ++after;
        if (after < line.size() && line[after] == '"') {
          return readStringValue(line, after);
        }
      }
    }

    // Kein gueltiges Schluessel-Wert-Paar an dieser Stelle (z.B. der
    // Schluesselname tauchte hier als WERT eines anderen Feldes auf, oder
    // sein Wert ist keine Zeichenkette) - an der naechsten Fundstelle weiter
    // suchen statt sofort aufzugeben.
    searchFrom = at + needle.size();
  }
}

bool numberFromJson(const std::string& line, const char* key, unsigned long long* out) {
  // Zahlen-Gegenstueck zu fieldFromJson() oben: DIESELBE Schluessel-Positions-
  // Pruefung (unmittelbar davor '{' oder ',' - siehe dort fuer die
  // Begruendung), nach dem Doppelpunkt wird aber eine ZIFFERNFOLGE erwartet
  // statt eines Anfuehrungszeichens. Ohne dieses Gegenstueck kann "id" bei
  // videoSubscribe/videoUnsubscribe (Aufgabe 2 legt es als Zahl fest) nie
  // gelesen werden - fieldFromJson() liefert fuer ein Zahlenfeld IMMER ""
  // (Nachbesserungsrunde 1, Critical: dieser Fehler machte das Merkmal gegen
  // einen echten Prozess unbenutzbar, jedes echte videoSubscribe/
  // videoUnsubscribe meldete deterministisch videoUnknownParticipant).
  const std::string needle = std::string("\"") + key + "\"";
  size_t searchFrom = 0;

  while (true) {
    size_t at = line.find(needle, searchFrom);
    if (at == std::string::npos) return false;

    bool isKeyPosition = false;
    size_t p = at;
    while (p > 0 && isJsonSpace(line[p - 1])) --p;
    if (p > 0 && (line[p - 1] == '{' || line[p - 1] == ',')) isKeyPosition = true;

    if (isKeyPosition) {
      size_t after = at + needle.size();
      while (after < line.size() && isJsonSpace(line[after])) ++after;
      if (after < line.size() && line[after] == ':') {
        ++after;
        while (after < line.size() && isJsonSpace(line[after])) ++after;
        if (after < line.size() && line[after] >= '0' && line[after] <= '9') {
          size_t end;
          bool overflow;
          const unsigned long long value = readUnsignedDigits(line, after, &end, &overflow);
          // Ueberlauf zaehlt als "nicht auswertbar", nicht als eine (durch
          // den Ueberlauf verstuemmelte) Zahl - dieselbe Sorgfalt wie beim
          // std::stoul-try/catch-Fix in main.cpp (Task 3).
          if (overflow) return false;
          *out = value;
          return true;
        }
      }
    }

    // Kein gueltiges Schluessel-Wert-Paar an dieser Stelle (z.B. der
    // Schluesselname tauchte hier als WERT eines anderen Feldes auf, oder
    // sein Wert ist keine reine Ziffernfolge) - an der naechsten Fundstelle
    // weiter suchen statt sofort aufzugeben. Dasselbe Verhalten wie
    // fieldFromJson() oben.
    searchFrom = at + needle.size();
  }
}

std::string cmdOf(const std::string& line) {
  return fieldFromJson(line, "cmd");
}
