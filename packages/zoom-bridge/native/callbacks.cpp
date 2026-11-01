#include "callbacks.h"
#include <atomic>
#include <deque>
#include <mutex>
#include "rawdata/zoom_rawdata_api.h"  // HasRawdataLicense()
#include "audio.h"
#include "emit.h"
#include "session.h"
#include "video.h"

// Wird im Rueckruf gesetzt und in main() genommen. Beide laufen auf dem
// HAUPTTHREAD (der Rueckruf kommt aus pumpOnce()), ein einfaches bool taete
// es also - std::atomic steht hier als AUSSAGE: dieses Merkzeichen ueberquert
// eine Grenze, an der schon einmal etwas schiefging, und exchange() macht
// Nehmen-und-Loeschen zu EINEM Schritt statt zu zweien.
static std::atomic<bool> g_meetingEndeOffen{false};

bool callbacksTakeMeetingEndTeardown() { return g_meetingEndeOffen.exchange(false); }

// Dasselbe Muster fuer den ENTZUG der Aufnahme-Erlaubnis (Stage 4b, N4b.1):
// onRecordPrivilegeChanged(false) setzt es, main() nimmt es nach pumpOnce() und
// baut dort ab - nie im Rueckruf (siehe das Meeting-Ende unten, 0xC0000005).
static std::atomic<bool> g_entzugAbbauOffen{false};

bool callbacksTakePrivilegeRevokedTeardown() { return g_entzugAbbauOffen.exchange(false); }

namespace {
ParticipantsListener g_participantsListener;

// --- Merker der Slots (Spec 6.5) ---------------------------------------------------
// Eine Sperre fuer alle vier Warteschlangen: die Rueckrufe halten sie nur fuer ein
// push_back, die Hauptschleife nur fuer ein pop_front - nie ueber einem SDK- oder
// NDI-Aufruf und nie ueber emitRaw/emitLog.
std::mutex g_merkerMutex;
std::deque<MerkerTeilnehmer> g_merkerTeilnehmer;
std::deque<MerkerKamera> g_merkerKamera;
std::deque<MerkerFreigabe> g_merkerFreigabe;
std::deque<MerkerSprecher> g_merkerSprecher;
std::atomic<uint64_t> g_merkerVerworfen{0};
// INMEETING kam (6.6 Nr. 4: zuerst dieser Merker). Ein Merkzeichen statt einer
// Warteschlange: zwei INMEETING vor dem naechsten Nehmen verlangen dieselbe Arbeit.
std::atomic<bool> g_inMeetingOffen{false};
// Renderer-Sperre (6.5): ab DISCONNECTING/RECONNECTING bis zum Loesen durch die
// Hauptschleife.
std::atomic<bool> g_rendererSperre{false};
// Der zuletzt gemeldete Meeting-Status (Nachtrag N2b.1): die INMEETING-Kette loest die
// Sperre nur, wenn er beim Ausfuehren noch im Meeting ist. Rueckruf und Kette laufen beide
// auf dem Hauptthread (pumpOnce bzw. Hauptschleife) - std::atomic wie bei den Merkern oben.
std::atomic<int> g_letzterStatus{static_cast<int>(MEETING_STATUS_IDLE)};

// Reiht ein, solange die Warteschlange unter kMerkerMax liegt; sonst zaehlt es den
// verlorenen Merker (bridgeStats.merkerVerworfen, T61). Das NEUE wird verworfen:
// die Reihenfolge der schon wartenden bleibt so erhalten.
template <class T>
void merkerEinreihen(std::deque<T>& q, T&& wert) {
  std::lock_guard<std::mutex> lock(g_merkerMutex);
  if (q.size() >= kMerkerMax) {
    g_merkerVerworfen.fetch_add(1);
    return;
  }
  q.push_back(std::move(wert));
}

template <class T>
bool merkerNehmen(std::deque<T>& q, T* out) {
  if (out == nullptr) return false;
  std::lock_guard<std::mutex> lock(g_merkerMutex);
  if (q.empty()) return false;
  *out = std::move(q.front());
  q.pop_front();
  return true;
}
// Hier stand qpcJetzt() fuer MerkerSprecher.qpc - entfernt mit dem Feld (Abschluss-Fix, Restpunkt R-e: nach F10 nur
// noch geschrieben, speakerSignal.ms kommt aus jetztMs()).
}  // namespace

bool callbacksTakeInMeeting() { return g_inMeetingOffen.exchange(false); }
bool callbacksTakeTeilnehmer(MerkerTeilnehmer* out) { return merkerNehmen(g_merkerTeilnehmer, out); }
bool callbacksTakeKamera(MerkerKamera* out) { return merkerNehmen(g_merkerKamera, out); }
bool callbacksTakeFreigabe(MerkerFreigabe* out) { return merkerNehmen(g_merkerFreigabe, out); }
bool callbacksTakeSprecher(MerkerSprecher* out) { return merkerNehmen(g_merkerSprecher, out); }
uint64_t merkerVerworfen() { return g_merkerVerworfen.load(); }
bool callbacksRendererSperre() { return g_rendererSperre.load(); }
void callbacksRendererSperreLoesen() { g_rendererSperre = false; }

static_assert(MEETING_STATUS_INMEETING == slotlogic::STATUS_INMEETING && MEETING_STATUS_LOCKED == slotlogic::STATUS_LOCKED &&
                  MEETING_STATUS_UNLOCKED == slotlogic::STATUS_UNLOCKED,
              "MeetingStatus wie slotlogic::STATUS_*");
bool callbacksStatusImMeeting() { return slotlogic::statusImMeeting(g_letzterStatus.load()); }

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
    // Einstellungsdienst einmal nach der Anmeldung, nur lesend (Spec 6.11).
    // Scheitert er, meldet sessionSettingsOpen() das auf stderr.
    sessionSettingsOpen();
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
  // Vor allen Zweigen (Nachtrag N2b.1): die INMEETING-Kette fragt ihn beim Loesen der Sperre.
  g_letzterStatus = static_cast<int>(status);

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
    // Die drei Lauscher der Slots (Spec 6.5) - wie der Teilnehmer-Lauscher bei
    // JEDEM INMEETING. Alles Uebrige zu INMEETING (eigene Kennung, Sprecher-
    // Erinnerung, Freigabe-Liste, Loesen der Renderer-Sperre, Umhaengen) macht die
    // Hauptschleife, wenn sie den Merker nimmt (6.6 Nr. 4; Nachbesserung B33).
    sessionRegisterCtrlListeners();
    g_inMeetingOffen = true;
  }

  // RENDERER-SPERRE (Spec 6.5, Nachbesserung B34): gemessen ist die Folge
  // disconnecting -> failed -> ended mit weiterlaufendem SDK-Thread
  // (session.cpp), und schon vor disconnecting kommt RawData_Off. Ab hier ruft
  // die Hauptschleife keine Renderer-Funktion mehr, bis INMEETING oder das
  // Meeting-Ende die Sperre loest. Nur das Atom - kein Abbau im Rueckruf.
  if (status == MEETING_STATUS_DISCONNECTING || status == MEETING_STATUS_RECONNECTING) {
    // Ein noch nicht genommenes INMEETING ist ueberholt (Nachtrag N2b.1, Task-14-Review C1):
    // sonst loeste es in merkerNehmen() die eben gesetzte Sperre, und die Kette riefe
    // unSubscribe/destroyRenderer/subscribe, waehrend Zoom trennt.
    g_inMeetingOffen = false;
    g_rendererSperre = true;
    emitLog(L"Renderer-Sperre an (Zoom trennt oder verbindet neu)");
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
    // Ebenso nach dem Ende (N2b.1): die Meeting-Ende-Kette loest die Sperre; ein ueberholtes
    // INMEETING riefe danach noch SDK-Abfragen an einem beendeten Meeting.
    g_inMeetingOffen = false;
    sessionClearCanRecordRaw();
    // Aus demselben Grund und an derselben Stelle: der Rohdaten-Schalter gilt
    // je MEETING. Bliebe er stehen, hielte das naechste Meeting ihn faelschlich
    // fuer bereits gelegt und subscribe() liefe ins Leere.
    sessionClearRawRecording();
    // Das Ton-Abo gilt je Meeting - dieselbe Begruendung wie beim
    // Rohdaten-Schalter darueber. Seit der Schlusspruefung (Critical 2)
    // MELDET diese Zeile auch ab (unSubscribe()), statt nur ein Merkzeichen
    // zu loeschen: sonst blieb der Delegate auf genau diesem Weg eingetragen,
    // und der spaetere audioShutdown() sah "nicht abonniert" und kehrte
    // zurueck, ohne abzumelden.
    //
    // VOR videoMeetingEnded(), dieselbe Reihenfolge wie beim "leave"-Befehl
    // und beim Prozessende (main.cpp): der Lauscher gehoert weg, BEVOR die
    // Abos verschwinden - ein Lauscher ohne Abos fuellt eine Warteschlange,
    // die niemand mehr leert.
    // NICHT HIER ABBAUEN. GEMESSEN am 18.08.2026 mit den Abbau-Marken: die
    // letzte gedruckte Zeile war "Abbau <id>: unSubscribe()", danach starb
    // der Prozess mit exitCode 3221225477 = 0xC0000005. Der Fehler lag also
    // WEDER in destroyRenderer() NOCH im NDI-Schliessen NOCH im
    // g_subs.clear() - und damit NICHT in Befund I6, wie zuerst vermutet.
    //
    // Dieser Rueckruf kommt INNERHALB von pumpOnce() an (main.cpp): wer von
    // hier aus unSubscribe() ruft, ruft ins SDK hinein, waehrend das SDK
    // seinen eigenen Meeting-Abbau abarbeitet. Der bisherige Sicherheitsbeleg
    // in videoMeetingEnded() ("gemessen statt gehofft") hat einen ANDEREN
    // Aufrufort gemessen: am 13.08. lief videoShutdownAll() aus main(), also
    // NACH Rueckkehr aus dem Rueckruf. Die Messung wurde auf einen Aufrufort
    // uebertragen, den sie nie abgedeckt hat.
    //
    // Das Merkzeichen wird darum nur GESETZT; main() nimmt es unmittelbar
    // nach pumpOnce() und baut ab - derselbe Schleifendurchlauf, aber
    // ausserhalb des Rueckrufs. Dieselbe Trennung, aus der der Ton-Weg
    // ohnehin schon besteht (SDK-Thread fuellt eine Warteschlange, der
    // Hauptthread leert sie).
    g_meetingEndeOffen = true;
    emitLog(L"Meeting-Ende: Abbau angemeldet, laeuft nach pumpOnce()");
    // Die Abos gehoeren ebenfalls dem Meeting. GEMESSEN am 2026-08-13: ohne
    // diesen Abbau ueberlebte ein Abo das Ende seiner Sitzung, und der
    // Herzschlag hielt eine NDI-Quelle am Leben, zu der es kein Meeting mehr
    // gab. Er laeuft jetzt in main(), nicht mehr hier - siehe oben.
    //
    // HIER STAND EINE MARKE "Abbau zurueckgekehrt, Bruecke laeuft weiter",
    // die beim Verschieben des Abbaus stehenblieb und damit einen Abbau als
    // abgeschlossen meldete, der noch gar nicht begonnen hatte. Sie ist
    // entfernt; die richtige steht in main(), hinter dem Abbau. Eine Marke
    // gehoert dorthin, wo das Gemeldete WIRKLICH passiert ist - sonst ist sie
    // schlimmer als keine, weil man ihr glaubt.
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
    // KEIN Umhaengen im Rueckruf (Spec E6, 0.2): nur der Merker. Was ein
    // Beitritt fuer die Slots heisst, entscheidet die Hauptschleife.
    merkerEinreihen(g_merkerTeilnehmer, MerkerTeilnehmer{id, true});
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
    // Das bestehende "left"-Ereignis bleibt unveraendert. Die Slots erfahren den
    // Weggang ueber den Merker; unSubscribe() laeuft in der Hauptschleife (6.7).
    merkerEinreihen(g_merkerTeilnehmer, MerkerTeilnehmer{id, false});
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
  if (!bCanRec) {
    // ENTZUG (Stage 4b, N4b.1). Zoom verlangt: "The app must stop accessing
    // content if permission is revoked." Bis 4a sperrte der Entzug nur NEUE
    // Abos (videoSubscribe() prueft sessionCanRecordRaw()); laufende sendeten
    // weiter.
    //
    // NICHT HIER ABBAUEN - dieselbe Lehre wie beim Meeting-Ende (18.08.2026):
    // dieser Rueckruf kommt INNERHALB von pumpOnce(), und unSubscribe() aus
    // einem SDK-Rueckruf beendete die Bridge mit 0xC0000005. Nur das
    // Merkzeichen setzen; main() baut nach pumpOnce() ab, im selben
    // Schleifendurchlauf.
    //
    // Kommt die Wiedererteilung in DERSELBEN Pumprunde (true nach false), steht
    // sie schon auf der Leitung, BEVOR abgebaut wird - abgebaut wird trotzdem:
    // die Abos gehoerten zur entzogenen Erlaubnis, neu abonniert der Aufrufer.
    g_entzugAbbauOffen = true;
    emitLog(L"Entzug: Abbau angemeldet, laeuft nach pumpOnce()");
  }
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

// --- Die drei Lauscher der Slots (Spec 6.5) ------------------------------------------
// Jeder Rumpf kopiert Werte in einen Merker und kehrt zurueck; hoechstens eine
// stderr-Zeile. Kein Renderer-Aufruf, kein slot...-Aufruf, kein emitRaw (PT6 a).

void ShareListener::onSharingStatus(ZoomSDKSharingSourceInfo shareInfo) {
  // contentType kann bei Begin vorlaeufig SHARE_TYPE_UNKNOWN sein
  // (meeting_sharing_interface.h:60-65, :162-164); der Typ-Nachtrag zieht ihn nach.
  merkerEinreihen(g_merkerFreigabe, MerkerFreigabe{shareInfo.userid, shareInfo.shareSourceID,
                                                   static_cast<int>(shareInfo.status),
                                                   static_cast<int>(shareInfo.contentType), false});
}

void ShareListener::onFailedToStartShare() {
  emitLog(L"Freigabe: onFailedToStartShare (die Bridge teilt nie selbst)");
}

void ShareListener::onShareContentNotification(ZoomSDKSharingSourceInfo shareInfo) {
  merkerEinreihen(g_merkerFreigabe, MerkerFreigabe{shareInfo.userid, shareInfo.shareSourceID,
                                                   static_cast<int>(shareInfo.status),
                                                   static_cast<int>(shareInfo.contentType), true});
}

void ShareListener::onMultiShareSwitchToSingleShareNeedConfirm(IShareSwitchMultiToSingleConfirmHandler* /*handler_*/) {
  // NICHTS aufrufen: Confirm() stoppt alle Freigaben (meeting_sharing_interface.h:144).
  emitLog(L"Freigabe: Zoom fragt nach dem Wechsel auf eine einzige Freigabe - die Bridge bestaetigt nichts");
}

void VideoCtrlListener::onUserVideoStatusChange(unsigned int userId, VideoStatus status) {
  merkerEinreihen(g_merkerKamera, MerkerKamera{userId, static_cast<int>(status)});
}

void VideoCtrlListener::onHostRequestStartVideo(IRequestStartVideoHandler* /*handler_*/) {
  emitLog(L"Video: der Gastgeber bittet, das eigene Video zu starten - die Bridge sendet kein Bild");
}

void VideoCtrlListener::onActiveSpeakerVideoUserChanged(unsigned int userid) {
  merkerEinreihen(g_merkerSprecher, MerkerSprecher{0, std::vector<unsigned>{userid}});
}

void VideoCtrlListener::onActiveVideoUserChanged(unsigned int userid) {
  merkerEinreihen(g_merkerSprecher, MerkerSprecher{1, std::vector<unsigned>{userid}});
}

void VideoCtrlListener::onCameraControlRequestReceived(unsigned int /*userId*/, CameraControlRequestType /*requestType*/,
                                                       ICameraControlRequestHandler* /*pHandler*/) {
  emitLog(L"Video: Anfrage zur Kamerasteuerung - die Bridge hat keine Kamera und antwortet nicht");
}

void AudioCtrlListener::onUserActiveAudioChange(IList<unsigned int >* plstActiveAudio) {
  // Die Lebensdauer der Liste nennt der Header nicht (meeting_audio_interface.h:122):
  // darum JETZT kopieren.
  std::vector<unsigned> ids;
  for (int i = 0; plstActiveAudio != nullptr && i < plstActiveAudio->GetCount(); ++i) ids.push_back(plstActiveAudio->GetItem(i));
  merkerEinreihen(g_merkerSprecher, MerkerSprecher{2, std::move(ids)});
}

void AudioCtrlListener::onHostRequestStartAudio(IRequestStartAudioHandler* /*handler_*/) {
  emitLog(L"Ton: der Gastgeber bittet, das eigene Mikrofon zu starten - die Bridge sendet keinen Ton");
}
