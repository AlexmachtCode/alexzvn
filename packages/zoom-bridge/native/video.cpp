#include "video.h"
#include <atomic>
#include <map>
#include <memory>
#include <mutex>
#include "emit.h"
#include "ndi_sender.h"
#include "rawdata/zoom_rawdata_api.h"
// rawdata_renderer_interface.h (ueber video.h) FORWARD-deklariert
// YUVRawDataI420 nur ("class YUVRawDataI420;") - die vollstaendige Klasse mit
// GetBuffer()/GetStreamWidth()/GetRotation()/IsLimitedI420() steht erst hier.
// Ohne diesen Include bricht der Bau an jeder Methode auf *data mit C2027
// ("Verwendung des undefinierten Typs") ab.
#include "zoom_sdk_raw_data_def.h"
#include "session.h"

namespace {

struct Sub;
std::map<unsigned int, std::unique_ptr<Sub>> g_subs;

class Delegate : public IZoomSDKRendererDelegate {
 public:
  explicit Delegate(Sub* owner) : owner_(owner) {}
  void onRendererBeDestroyed() override {}
  void onRawDataFrameReceived(YUVRawDataI420* data) override;
  void onRawDataStatusChanged(RawDataStatus status) override;
 private:
  Sub* owner_;
};

struct Sub {
  // ATOMAR statt eines rohen unsigned int (Nachbesserung Runde 1, Befund 1):
  // videoParticipantJoined() (Aufgabe 6) aendert userId zur LAUFZEIT beim
  // Umhaengen - vorher stand es nach dem Anlegen fest. emitVideo()/
  // emitVideoMeasured() lesen s.userId dagegen ABSICHTLICH AUSSERHALB der
  // fieldMutex-Sperre (Regel: kein emit*() im Sperrblock) und werden auch vom
  // SDK-Thread aus gerufen (Delegate::onRawDataFrameReceived/
  // onRawDataStatusChanged). Ein Sperren des Schreibens allein haette den
  // Wettlauf NICHT geloest, weil die Leseseite weiterhin ungesperrt bliebe -
  // std::atomic macht BEIDE Seiten sicher, ohne emit*() in einen Sperrblock
  // zu ziehen.
  std::atomic<unsigned int> userId{0};
  // ABBAU SCHLAEGT ALLES. GEMESSEN im Owner-Lauf vom 2026-08-13: nach
  // "unsubscribed" kam noch ein "black (cameraOff)" hinterher - das SDK
  // schiebt auf unSubscribe() ein RawData_Off nach, und der Status-Rueckruf
  // meldete es ueber ein Abo, das es nicht mehr gibt. Eine Aussage ueber die
  // Kamera von jemandem, dessen Abo gerade abgebaut wird, ist doppelt falsch:
  // die Ursache stimmt nicht (niemand hat die Kamera ausgemacht), und der
  // Zustand danach ist nicht "schwarz", sondern "weg".
  //
  // ATOMAR und OHNE die fieldMutex-Sperre gelesen, damit beide Rueckrufe
  // sofort am Kopf abbrechen koennen - derselbe Grund wie bei userId. Wird
  // gesetzt, BEVOR unSubscribe() laeuft, nie danach: das Fenster, das dieser
  // Riegel schliesst, oeffnet genau dieser Aufruf.
  //
  // NEBENBEFUND ZU I6, GEMESSEN: dass dieses Ereignis ueberhaupt ankam,
  // BEWEIST, dass Rueckrufe waehrend des Abbaus noch laufen. Die Lebensdauer-
  // Annahme in videoUnsubscribe() ist damit nicht widerlegt (es gab keinen
  // Absturz), aber das Fenster ist nachweislich real und nicht theoretisch.
  std::atomic<bool> imAbbau{false};
  std::string persistentId;
  std::string source;          // der TATSAECHLICH vergebene NDI-Name
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  IZoomSDKRenderer* renderer = nullptr;
  std::unique_ptr<Delegate> delegate;
  NdiSender sender;

  // Sperre NUR fuer die Feldbuchfuehrung unten (mismatchGemeldet bis
  // gemessen), NICHT fuer sender: der Bild-Rueckruf laeuft auf einem
  // SDK-Thread und schreibt diese Felder, waehrend die Hauptschleife
  // (Herzschlag, Aufgabe 5) gegenlaeufig liest und schreibt - ohne Sperre
  // waere das bei den beiden std::string-Feldern (state, reason) nicht
  // bloss ein logischer Fehler, sondern ein moeglicher Absturz durch
  // zerrissenen Zugriff. EIGENE Sperre JE ABO, keine globale - aus
  // demselben Grund, aus dem NdiSender seine Sperre je Sender haelt (siehe
  // ndi_sender.h): zwei Abos duerfen sich nicht gegenseitig ausbremsen.
  // Wird NIE ueber sender.sendI420() gehalten: NDIlib_send_send_video_v2
  // kann blockieren, bis der Puffer ausgelesen ist, und diese Sperre
  // ineinander mit der von NdiSender zu halten waere eine Verschraenkung,
  // die sich spaeter nur schwer wieder aufloest. Muster im Rueckruf darum
  // immer: erst Werte lokal aus dem Bild ziehen und senden, DANACH diese
  // Sperre nehmen und die Felder fortschreiben.
  std::mutex fieldMutex;
  bool mismatchGemeldet = false;
  // "Der Teilnehmer ist gegangen" - gesetzt in videoParticipantLeft(),
  // geloescht beim Umhaengen (videoParticipantJoined()) und bei jedem neu
  // angelegten Abo (Vorgabewert false).
  //
  // WARUM ES DIESES MERKZEICHEN BRAUCHT (Abschluss-Sichtung, I3): der
  // Bild-Rueckruf laeuft auf einem SDK-Thread und haelt sendI420()
  // AUSSERHALB jeder Sperre in Arbeit. Faellt videoParticipantLeft()
  // (Hauptthread) genau in dieses Fenster, schrieb der Rueckruf danach
  // "live"/"frames" ueber das gerade gesetzte "black"/"participantLeft" -
  // samt Ereignis, fuer jemanden, der nachweislich weg ist. 200 ms spaeter
  // meldete der Herzschlag dann "black"/"cameraOff", und der Endstand war
  // "Kamera aus" fuer einen Gast, der das Meeting verlassen hat: zwei
  // Ursachen, ein Name - genau das, was Abschnitt 5 der Spec ausschliesst
  // (und Abnahmepunkt 4 prueft). Ein Zeitvergleich (lastFrameMs gegen den
  // Weggeh-Zeitpunkt) waere hier die schlechtere Wahl: er raet aus einer
  // Uhr, was ein Merkzeichen WEISS.
  bool teilnehmerWeg = false;
  ULONGLONG lastFrameMs = 0;     // 0 = noch nie ein Bild gesehen
  ULONGLONG lastBlackMs = 0;     // wird in Task 5 gebraucht
  int lastW = 0;
  int lastH = 0;
  std::string state = "subscribed";
  std::string reason = "command";
  unsigned int rotation = 0;
  bool limitedRange = true;
  bool gemessen = false;         // ob rotation/limitedRange je ein Bild gesehen haben
};

// Der Name steht bei subscribe FEST und folgt keiner Umbenennung: einen
// NDI-Sender umzubenennen hiesse, ihn abzubauen und neu aufzubauen - die
// Quelle waere mitten in der Sendung weg.
//
// KEIN DOPPELPUNKT nach "Zoom" - gemessen am 13.08.2026 gegen die echte
// NDI-Laufzeit: sie ersetzt ':' durch ein Leerzeichen, "Zoom:" haette also
// ein DOPPELTES Leerzeichen hinterlassen. Aus derselben Messung: NDI stellt
// jedem Namen den RECHNERNAMEN in Klammern voran - was im Switcher steht,
// ist "RECHNERNAME (JM Connect – Zoom Anna)". Wer auf den Namen prueft,
// prueft darum auf Teilzeichenketten, nie auf Gleichheit.
std::string uniqueSourceName(const std::wstring& displayName) {
  const std::string base = "JM Connect – Zoom " + toUtf8(displayName);
  std::string name = base;
  int n = 2;
  bool belegt = true;
  while (belegt) {
    belegt = false;
    for (const auto& [id, sub] : g_subs) {
      if (sub->source == name) { belegt = true; break; }
    }
    if (belegt) name = base + " (" + std::to_string(n++) + ")";
  }
  return name;
}

void emitVideo(const Sub& s, const char* state, const char* reason) {
  // .load() ausdruecklich statt der impliziten Wandlung: s.userId ist
  // std::atomic<unsigned int>, dieser Aufruf kann vom SDK-Thread kommen,
  // WAEHREND der Hauptthread es umhaengt (siehe Kommentar am Feld).
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId.load()) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") + "}");
}

// Wie emitVideo(), aber MIT den beiden gemessenen Feldern. Zwei getrennte
// Funktionen statt einer mit Schaltern: rotation und limitedRange duerfen
// erst auftauchen, wenn ein Bild sie geliefert hat (Spec Abschnitt 5). Eine
// erfundene 0 liesse sich spaeter nicht von einer gemessenen 0 unterscheiden.
void emitVideoMeasured(const Sub& s, const char* state, const char* reason,
                       unsigned int rotation, bool limitedRange) {
  // .load() aus demselben Grund wie in emitVideo() oben.
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId.load()) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") +
          ",\"rotation\":" + std::to_string(rotation) +
          ",\"limitedRange\":" + (limitedRange ? "true" : "false") + "}");
}

void emitVideoError(const char* code) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code + "\"}");
}

// Ein SDKError, der NICHT auf die Rohrleitung gehoert - stdout ist Maschine,
// stderr ist Mensch. Verworfen wird trotzdem keiner: an den Abbaustellen
// (unSubscribe/destroyRenderer) ist ein Fehlschlag keine Protokolltatsache,
// auf die ein Aufrufer reagieren koennte - das Abo geht in JEDEM Fall weg,
// und ein zweiter Ereignisname fuer "der Abbau hat gemurrt" waere ein Name
// ohne eigene Handlung dahinter. Er darf aber auch nicht STILL verschwinden
// (Kernregel), also geht er als Klartext an den Menschen, der die Rohausgabe
// mitliest. Ausnahme und ausdruecklich anders behandelt: das subscribe()
// beim Umhaengen - dort ist der Fehlschlag sehr wohl eine Tatsache ueber ein
// Abo, das der Aufrufer weiterfuehrt, und geht darum als
// videoRendererFailed auf stdout (siehe videoParticipantJoined()).
void logSdkError(const wchar_t* was, SDKError err) {
  if (err == SDKERR_SUCCESS) return;
  emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei ") + was + L": SDKError=" +
          std::to_wstring(static_cast<int>(err)));
}

// Die fuenf NENNGROESSEN der Abos (siehe videoParseResolution()). Der
// Herzschlag (videoTick()) braucht sie fuer das ALLERERSTE Schwarzbild -
// vor dem ersten empfangenen Bild ist die tatsaechliche Groesse (lastW/
// lastH) noch 0/unbekannt, die Quelle soll aber von Anfang an eine GUELTIGE
// NDI-Aufloesung haben statt erst nach dem ersten Bild. Ein res-Wert
// ausserhalb dieser fuenf kann hier nicht ankommen: res wird ausschliesslich
// ueber videoParseResolution() (fieldFromJson()) oder die Vorgabe 720p
// (main.cpp) gesetzt.
int nominalWidth(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_90P:   return 160;
    case ZoomSDKResolution_180P:  return 320;
    case ZoomSDKResolution_360P:  return 640;
    case ZoomSDKResolution_720P:  return 1280;
    case ZoomSDKResolution_1080P: return 1920;
    default:                      return 1280;   // sollte nie erreicht werden, siehe oben
  }
}

int nominalHeight(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_90P:   return 90;
    case ZoomSDKResolution_180P:  return 180;
    case ZoomSDKResolution_360P:  return 360;
    case ZoomSDKResolution_720P:  return 720;
    case ZoomSDKResolution_1080P: return 1080;
    default:                      return 720;    // sollte nie erreicht werden, siehe oben
  }
}

}  // namespace

bool videoParseResolution(const std::string& key, ZoomSDKResolution* out) {
  if (key == "90p")   { *out = ZoomSDKResolution_90P;   return true; }
  if (key == "180p")  { *out = ZoomSDKResolution_180P;  return true; }
  if (key == "360p")  { *out = ZoomSDKResolution_360P;  return true; }
  if (key == "720p")  { *out = ZoomSDKResolution_720P;  return true; }
  if (key == "1080p") { *out = ZoomSDKResolution_1080P; return true; }
  return false;
}

void videoSubscribe(unsigned int userId, ZoomSDKResolution res) {
  if (g_subs.count(userId)) { emitVideoError("videoAlreadySubscribed"); return; }
  // Die Erlaubnis ist Voraussetzung, kein Wunsch (siehe Spec Abschnitt 5).
  if (!sessionCanRecordRaw()) { emitVideoError("videoNoPrivilege"); return; }

  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) {
    emitVideoError("videoUnknownParticipant");
    return;
  }

  // DIE FEHLENDE NDI-LAUFZEIT BEKOMMT IHREN EIGENEN NAMEN (Abschluss-
  // Sichtung, M3). Ohne diese Abfrage schluege gleich NDIlib_send_create()
  // fehl und meldete "videoSenderFailed" - ein Name, der sagt "DIESER eine
  // Sender ging nicht", waehrend in Wahrheit auf diesem Rechner GAR KEIN
  // NDI laeuft. Die beiden schicken die Suche an verschiedene Orte (zum Abo
  // statt zur Installation), und genau davor warnt der Katalogkommentar in
  // src/protocol.ts.
  //
  // where:"ndi", NICHT "video" - dieselbe Stelle, die main.cpp beim
  // Fehlschlag von ndiInitialize() selbst meldet. Ein Schluessel, der je
  // nach Melder unter zwei verschiedenen "where" auftaucht, waere derselbe
  // Fehler noch einmal, nur eine Ebene hoeher.
  if (!ndiIsUp()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
    return;
  }

  // DER SCHALTER, DEN STAGE 1 AUSGELASSEN HAT. Zooms Schrittfolge fuer
  // Rohdaten lautet: im Meeting -> Erlaubnis vom Gastgeber ->
  // StartRawRecording() -> Bilder ueber die Delegates. Ohne den dritten
  // Schritt gibt createRenderer() keinen Renderer heraus - GEMESSEN am
  // 2026-08-13, und zwar mit erteilter Erlaubnis. Der Name des Aufrufs luegt
  // (er schreibt keine Datei, siehe session.h), genau deshalb stand er nicht
  // im Quelltext.
  //
  // HIER und nicht bei der Erlaubnis-Abfrage: wer nie ein Video abonniert,
  // soll den Rohdaten-Weg des SDK auch nicht anschalten. Der Aufruf ist
  // idempotent, das erste Abo zahlt ihn fuer alle weiteren.
  //
  // EIGENER FEHLERNAME: "der Rohdaten-Schalter ging nicht um" schickt die
  // Suche an einen anderen Ort als "der Renderer kam nicht zustande" - beim
  // ersten ist das Meeting oder die Rolle schuld, beim zweiten das Abo.
  const SDKError rawErr = sessionStartRawRecording();
  if (rawErr != SDKERR_SUCCESS) {
    logSdkError(L"StartRawRecording()", rawErr);
    emitVideoError("videoRawRecordingFailed");
    return;
  }

  auto sub = std::make_unique<Sub>();
  sub->userId = userId;
  sub->persistentId = persistentId;
  sub->res = res;
  sub->source = uniqueSourceName(name);
  sub->delegate = std::make_unique<Delegate>(sub.get());

  if (!sub->sender.open(sub->source)) { emitVideoError("videoSenderFailed"); return; }

  // Der Protokollname bleibt EINER (videoRendererFailed) - ein Aufrufer kann
  // auf "der Renderer kam nicht zustande" genau eine Handlung stuetzen. Fuer
  // den MENSCHEN, der die Rohausgabe mitliest, sind es aber zwei
  // verschiedene Tatsachen an zwei verschiedenen Aufrufen, und ohne den
  // SDKError ist keine davon zu unterscheiden. GEMESSEN im Owner-Lauf vom
  // 2026-08-13: videoRendererFailed kam ohne jede weitere Angabe - man sieht
  // weder WELCHER Ruf scheiterte noch WOMIT. Darum stderr dazu, stdout
  // unveraendert (stdout ist Maschine, stderr ist Mensch).
  //
  // HasRawdataLicense() steht mit dabei, weil es die eine Frage beantwortet,
  // die man sonst nur raten kann: ob dieses Konto Rohdaten ueberhaupt DARF.
  // Ein fehlendes Recht sieht an dieser Stelle exakt aus wie ein Codefehler.
  SDKError err = createRenderer(&sub->renderer, sub->delegate.get());
  if (err != SDKERR_SUCCESS || sub->renderer == nullptr) {
    logSdkError(L"createRenderer()", err);
    emitLog(std::wstring(L"createRenderer() lieferte keinen Renderer. HasRawdataLicense()=") +
            (HasRawdataLicense() ? L"true" : L"false") +
            L" - false heisst: dieses Zoom-Konto hat kein Rohdaten-Recht, dann hilft kein Code.");
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }
  sub->renderer->setRawDataResolution(res);
  err = sub->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  if (err != SDKERR_SUCCESS) {
    logSdkError(L"subscribe() beim Anlegen des Abos", err);
    destroyRenderer(sub->renderer);
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }

  Sub* raw = sub.get();
  g_subs[userId] = std::move(sub);
  emitVideo(*raw, "subscribed", "command");
}

void videoUnsubscribe(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) { emitVideoError("videoNotSubscribed"); return; }
  Sub* s = it->second.get();
  // VOR der Meldung, nicht danach: zwischen emitVideo() und unSubscribe()
  // liegt ein Fenster, in dem ein Rueckruf noch etwas ueber dieses Abo sagen
  // koennte - und alles, was er dann sagt, kaeme NACH "unsubscribed".
  s->imAbbau = true;
  emitVideo(*s, "unsubscribed", "command");
  // REIHENFOLGE IST TRAGEND: erst den Renderer abmelden und abbauen, DANN
  // den Sender schliessen. Andersherum koennte ein Bild-Rueckruf, der schon
  // unterwegs ist, auf einen bereits abgebauten Sender schreiben.
  //
  // STAND DER MESSUNG ZU I6 (14.08.2026, npm run video-stress): 20 von 20
  // Wechseln MIT laufendem Bild und ZWEI gleichzeitigen Abos ueberstanden,
  // kein Absturz. Ausserdem gemessen (Sub::imAbbau): Rueckrufe laufen
  // waehrend des Abbaus tatsaechlich noch - das Fenster ist real, nicht
  // theoretisch. Beides zusammen WIDERLEGT die Annahme nicht und BEWEIST sie
  // auch nicht: ein Wettlauf, den man 20-mal nicht trifft, ist immer noch
  // ein Wettlauf. Wer hier je einen 0xC0000005 sieht, hat die Antwort - und
  // muss die Lebensdauer selbst verwalten.
  //
  // UNBELEGTE ANNAHME, AUSDRUECKLICH BENANNT (Abschluss-Sichtung, I6): das
  // g_subs.erase() unten zerstoert das Sub - MIT seinem fieldMutex und
  // seinem NdiSender -, waehrend Delegate::owner_ ein ROHER Zeiger darauf
  // ist. Das traegt nur, wenn destroyRenderer() synchron gegen einen
  // LAUFENDEN Rueckruf abschliesst: kehrt es zurueck, waehrend noch ein
  // onRawDataFrameReceived/onRawDataStatusChanged in Arbeit ist, greift
  // dieser Rueckruf anschliessend auf freigegebenen Speicher zu.
  //
  // WAS DIE KOPFDATEIEN DAZU HERGEBEN: NICHTS. Nachgesehen in
  // h/rawdata/zoom_rawdata_api.h (destroyRenderer ist dort eine einzige
  // Deklarationszeile, ohne @brief, @note oder sonst einen Kommentar) und in
  // h/rawdata/rawdata_renderer_interface.h (unSubscribe() ebenso, voellig
  // unkommentiert - subscribe() daneben hat @brief/@param/@return, es fehlt
  // also nicht bloss zufaellig an dieser einen Stelle). Eine Suche ueber
  // ALLE SDK-Kopfdateien nach "thread", "synchron", "concurren" und
  // "blocking" liefert zum Renderer keinen einzigen Treffer. Die einzige
  // Lebensdaueraussage im ganzen Renderer-Header steht an
  // onRendererBeDestroyed(): "After you handle this callback, you should
  // never use this renderer object any more" - das regelt UNSEREN Zugriff
  // auf den RENDERER, nicht den Zugriff des SDK auf UNSEREN Delegate. Es ist
  // also keine Zusicherung, sondern die Gegenrichtung.
  //
  // KEINE GROSSE UMKONSTRUKTION AUF VERDACHT: hier steht bewusst keine
  // Lebensdauerverwaltung (shared_ptr/Zaehlwerk/Verweilsperre), die ein
  // Problem loesen wuerde, das niemand gemessen hat - sie brauchte ihre
  // eigene Sperr-Ordnung und waere ihrerseits ungeprueft. Stattdessen ist
  // die Annahme HIER benannt: sie gehoert in die Owner-Abnahme (dort wird
  // unter laufenden Bildern ab- und wieder aufgebaut), und wenn dabei je ein
  // Zugriffsfehler an dieser Stelle auftritt, steht hier bereits, wo man
  // suchen muss.
  if (s->renderer) {
    logSdkError(L"unSubscribe() beim Abbau eines Abos", s->renderer->unSubscribe());
    logSdkError(L"destroyRenderer() beim Abbau eines Abos", destroyRenderer(s->renderer));
  }
  s->sender.close();
  g_subs.erase(it);
}

// Baut ALLE Abos ab und meldet jedes einzeln mit der uebergebenen Ursache.
// Zwei Aufrufer, zwei WAHRE Ursachen: der Aufrufer hat es befohlen ("command",
// ueber leave/quit/EOF) oder das Meeting ist zu Ende ("meetingEnded"). Ein
// gemeinsamer Rumpf, damit die beiden Wege nicht auseinanderlaufen - der
// Abbau selbst ist in beiden Faellen derselbe.
static void videoAbbauAlle(const char* reason) {
  for (auto& [id, s] : g_subs) {
    // JEDES Abo wird GEMELDET, bevor es abgebaut wird (Abschluss-Sichtung,
    // I4). Am Prozessende ist das gleichgueltig, beim "leave"-Befehl NICHT:
    // dort laeuft die Bridge weiter, die NDI-Quellen sind aber weg. Ohne
    // diese Zeile hielte Session.videoSubs (src/state.ts) sie unveraendert
    // fest - reduce() raeumt bei "ended"/"failed" nur die Teilnehmerliste ab,
    // nie die Abos -, und der Aufrufer saehe Quellen, die es nicht mehr gibt.
    // Genau die stille Sorte Fehler, die dieses Vorhaben ausschliesst.
    //
    // DIE URSACHE KOMMT VOM AUFRUFER und ist nie geliehen: "command", wenn
    // der Aufrufer es befohlen hat (leave/quit/EOF), "meetingEnded", wenn das
    // Meeting zu Ende ist. Beides als "command" zu melden waere die Sorte
    // Namensleihe, die dieses Vorhaben ausschliesst - niemand hat etwas
    // befohlen, als der Gastgeber die Sitzung beendete.
    //
    // emitRaw() spuelt selbst (siehe emit.h/emit.cpp) - die Zeilen stehen
    // also auch dann vollstaendig auf stdout, wenn main() unmittelbar danach
    // ueber TerminateProcess aussteigt.
    // VOR der Meldung, gleiche Begruendung wie in videoUnsubscribe().
    s->imAbbau = true;
    emitVideo(*s, "unsubscribed", reason);
    // DIESELBE unbelegte Lebensdauer-Annahme wie in videoUnsubscribe() -
    // siehe den ausfuehrlichen Kommentar dort (Abschluss-Sichtung, I6): das
    // g_subs.clear() unten zerstoert jedes Sub samt fieldMutex, waehrend der
    // Delegate einen rohen Zeiger darauf haelt.
    if (s->renderer) {
      logSdkError(L"unSubscribe() beim Gesamtabbau", s->renderer->unSubscribe());
      logSdkError(L"destroyRenderer() beim Gesamtabbau", destroyRenderer(s->renderer));
    }
    s->sender.close();
  }
  g_subs.clear();
}

void videoShutdownAll() {
  videoAbbauAlle("command");
}

void videoMeetingEnded() {
  // GEMESSEN im Owner-Lauf vom 2026-08-13: nach "Status: ended (vom Gastgeber
  // entfernt)" blieb das Abo bestehen. Der Herzschlag schickte weiter
  // Schwarzbilder in eine NDI-Quelle, deren Meeting es nicht mehr gab - und
  // der letzte gemeldete Stand war "black (cameraOff)", also "jemand hat die
  // Kamera aus" fuer eine beendete Sitzung. Zwei Ursachen, ein Name.
  //
  // WARUM DER ABBAU HIER SICHER IST, und zwar gemessen statt gehofft: in
  // genau jenem Lauf lief videoShutdownAll() NACH dem "ended" durch und rief
  // unSubscribe()/destroyRenderer() auf Renderer eines bereits beendeten
  // Meetings - ohne Absturz. Der Abbau an dieser Stelle ist derselbe Aufruf
  // zum selben Zeitpunkt, nur ohne den Umweg ueber den Aufrufer.
  //
  // KEIN Schweigen und kein Weiterleben: ein Abo, das seine Sitzung
  // ueberlebt, ist genau der Fall, den der Kommentar an reduce() in
  // src/state.ts als den gefaehrlichen benennt.
  if (g_subs.empty()) return;
  videoAbbauAlle("meetingEnded");
}


// LAEUFT AUF DEM HAUPTTHREAD (siehe main.cpp: direkt nach pumpOnce(), alle
// 10 ms). Der Bild-Rueckruf (Delegate::onRawDataFrameReceived) laeuft auf
// einem SDK-Thread - beide treffen sich in den Feldern von Sub, darum
// dieselbe Sperr-Disziplin wie dort (siehe Sub::fieldMutex): erst lokal aus
// den Feldern lesen und ENTSCHEIDEN, dann OHNE Sperre senden, dann unter der
// Sperre fortschreiben. Die Sperre wird NIE ueber sender.sendBlack()
// gehalten - NdiSender haelt seine EIGENE Sperre, zwei ineinander gehaltene
// Sperren waeren eine Verschraenkung.
//
// Veraendert die KARTE g_subs selbst NICHT (kein insert/erase) - das bleibt
// Aufgabe 6 vorbehalten. Iterieren ohne Kartensperre ist hier gefahrlos,
// weil der Bild-Rueckruf die Karte nachweislich nicht anfasst (siehe
// Sub::fieldMutex-Kommentar) und alle Karten-Mutationen (videoSubscribe/
// videoUnsubscribe/videoShutdownAll) ohnehin auf demselben Hauptthread
// laufen wie videoTick() selbst.
void videoTick() {
  const ULONGLONG jetzt = GetTickCount64();
  for (auto& [id, s] : g_subs) {
    ULONGLONG lastFrameMs;
    ULONGLONG lastBlackMs;
    int lastW, lastH;
    ZoomSDKResolution res;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      lastFrameMs = s->lastFrameMs;
      lastBlackMs = s->lastBlackMs;
      lastW = s->lastW;
      lastH = s->lastH;
      res = s->res;
    }

    // 200 ms Nachlauf: bei kurzen Aussetzern soll NICHT zwischen Bild und
    // Schwarz geflackert werden. Erst danach gilt der Strom als still.
    if (lastFrameMs != 0 && jetzt - lastFrameMs < 200) continue;
    // Hoechstens alle 100 ms, also 10 Bilder je Sekunde. Das haelt die
    // Quelle fuer jeden Empfaenger gueltig und kostet fast nichts.
    if (jetzt - lastBlackMs < 100) continue;

    // Vor dem ersten Bild ist die Bildgroesse unbekannt - dann die
    // NENNGROESSE des Abos nehmen, damit die Quelle von Anfang an gueltig
    // ist statt erst nach dem ersten Bild.
    const int w = lastW > 0 ? lastW : nominalWidth(res);
    const int h = lastH > 0 ? lastH : nominalHeight(res);

    // Senden OHNE Sperre - sendBlack() nimmt NdiSenders eigene Sperre.
    s->sender.sendBlack(w, h);

    // Fortschreiben NACH dem Senden, wieder unter der Sperre. lastBlackMs
    // wird UNBEDINGT gesetzt (der Herzschlag lief gerade, das bereits
    // gesendete Schwarzbild laesst sich ohnehin nicht zurueckholen). Der
    // BERICHT (state/reason/Ereignis) ist dagegen an ZWEI Bedingungen
    // gebunden - beide aus der Nachbesserung (Befund 1+2):
    //
    // (a) lastFrameMs != 0 (die Momentaufnahme aus Sperre 1, NICHT
    //     s->lastFrameMs): war lastFrameMs beim Entscheiden bereits 0, hat
    //     dieses Abo noch NIE ein Bild gesehen - "cameraOff" wuerde ein
    //     SDK-Ereignis behaupten, das nie stattfand. Der Zustand bleibt
    //     "subscribed" (Spec: "Sender steht, noch kein Bild"), das
    //     Schwarzbild wird trotzdem gesendet.
    // (b) s->lastFrameMs == lastFrameMs: sendBlack() oben kann blockieren,
    //     bis NDI den Puffer ausgelesen hat (NDIlib_send_send_video_v2) -
    //     in dieser Spanne, WAEHREND diese Sperre nicht gehalten wird, kann
    //     der Bild-Rueckruf laengst ein neues Bild verarbeitet und
    //     s->lastFrameMs veraendert haben. Weicht der aktuelle Wert von der
    //     Momentaufnahme ab, ist die Entscheidung "still" VERALTET - der
    //     Strom laeuft nachweislich schon wieder, der Uebergang nach
    //     "black" (und die Meldung) unterbleibt. Das schon gesendete
    //     Schwarzbild bleibt stehen (hinnehmbar, ein einzelnes Bild ist
    //     kein falscher BERICHT), aber es wird nichts Falsches gemeldet.
    //
    // Ein bereits schwarzes Abo bekommt ausserdem keine weitere Meldung -
    // Wiederholung ohne neue Information. Ein laufender bufferMismatch ist
    // eine ANDERE Ursache als "Kamera aus" und bleibt darum erhalten.
    //
    // BERICHTIGT (Abschluss-Sichtung, I2): hier stand, reason werde beim
    // Uebergang nach "live" ohnehin auf "frames" zurueckgesetzt, es koenne
    // also nie ein veralteter Wert stehen. Das war zum Zeitpunkt des
    // Schreibens FALSCH: der Mismatch-Zweig im Bild-Rueckruf setzt nur
    // reason und laesst state unberuehrt - stand das Abo dabei schon auf
    // "live", traf die Live-Uebergangsbedingung beim naechsten guten Bild
    // nicht mehr zu, und "bufferMismatch" klebte fuer immer. Die Zeile
    // darunter meldete dann black/bufferMismatch fuer eine schlicht
    // ausgeschaltete Kamera. Die Bedingung im Bild-Rueckruf traegt seither
    // ein zusaetzliches `reason != "frames"` (siehe dort) - erst DAMIT
    // stimmt die Zusicherung, die dieser Kommentar macht.
    std::string emitReason;
    bool sollEmit = false;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      s->lastBlackMs = jetzt;
      if (lastFrameMs != 0 && s->lastFrameMs == lastFrameMs && s->state != "black") {
        s->state = "black";
        if (s->reason != "bufferMismatch") s->reason = "cameraOff";
        emitReason = s->reason;
        sollEmit = true;
      }
    }
    // emitVideo() ausserhalb JEDER Sperre - dieselbe Regel wie im
    // Bild-Rueckruf: kein emit*() innerhalb eines Sperrblocks.
    if (sollEmit) emitVideo(*s, "black", emitReason.c_str());
  }
}

// LAEUFT AUF DEM HAUPTTHREAD (die Teilnehmer-Rueckrufe onUserLeft/onUserJoin
// kommen ueber die Nachrichtenpumpe, siehe callbacks.cpp und main.cpp). Fasst
// dieselben Felder an wie der Bild-Rueckruf (state, reason, lastFrameMs,
// gemessen, mismatchGemeldet) - darum dieselbe Sperr-Disziplin wie dort und
// in videoTick() (siehe Sub::fieldMutex): die Sperre schuetzt NUR den
// Feldzugriff, wird NIE ueber einen Renderer- oder NDI-Aufruf gehalten und
// kein emit*() liegt in einem Sperrblock.
void videoParticipantLeft(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) return;
  Sub* s = it->second.get();
  // Das Abo bleibt bestehen - die Quelle darf im Livebetrieb nicht
  // wegbrechen (Spec Abschnitt 3). Der Herzschlag (videoTick()) haelt sie ab
  // jetzt schwarz.
  if (s->renderer) {
    logSdkError(L"unSubscribe() nach dem Weggang eines Teilnehmers", s->renderer->unSubscribe());
  }
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    s->state = "black";
    s->reason = "participantLeft";
    // ZUSAMMEN mit state/reason gesetzt, unter DERSELBEN Sperre: ein
    // Bild-Rueckruf, der gerade in sendI420() steht, darf danach weder
    // "live" behaupten noch die Ursache auf "cameraOff" umschreiben lassen -
    // siehe die ausfuehrliche Begruendung am Feld selbst.
    s->teilnehmerWeg = true;
  }
  emitVideo(*s, "black", "participantLeft");
}

// Ebenfalls HAUPTTHREAD, siehe videoParticipantLeft() oben.
// Anfang und Laenge einer persistentId - genug, um zwei Werte zu
// UNTERSCHEIDEN, zu wenig, um ein Zoom-Konto zu identifizieren. Eine
// vollstaendige Kennung gehoert nicht in eine Logzeile.
static std::wstring fingerprint(const std::string& id) {
  if (id.empty()) return L"(leer)";
  std::wstring anfang;
  for (size_t i = 0; i < id.size() && i < 6; ++i) anfang += static_cast<wchar_t>(id[i]);
  return anfang + L"… (" + std::to_wstring(id.size()) + L" Zeichen)";
}

void videoParticipantJoined(unsigned int userId) {
  // NICHTS VERSCHWINDET STILL. GEMESSEN am 14.08.2026: ein Gast ging und kam
  // zurueck, das Bild kam NICHT wieder - und diese Funktion stieg dabei ueber
  // einen von DREI stillen return-Wegen aus, ohne dass irgendwo eine Zeile
  // stand, welcher es war. Aus "Zoom kann diesen Gast nicht wiedererkennen"
  // und "unsere Suche hat nichts gefunden" wurde dieselbe Stille.
  //
  // Nur wenn es ueberhaupt Abos gibt: in einem grossen Meeting kommt diese
  // Funktion bei JEDEM Beitritt vorbei, und eine Zeile je Gast waere Laerm,
  // kein Befund.
  const bool interessant = !g_subs.empty();

  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) {
    if (interessant) {
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) +
              L": steht nicht in der Teilnehmerliste - kein Umhaengen.");
    }
    return;
  }

  // Eine LEERE persistentId kann NIEMANDEN wiedererkennen: zwei verschiedene
  // Gaeste haetten beide "" und wuerden aufeinander umgehaengt - aus einem
  // Wiederbeitritt wuerde eine Personenverwechslung auf Sendung. Kein Abo
  // traegt darum jemals eine leere persistentId zum Vergleich heran (siehe
  // uniqueSourceName/videoSubscribe), dieser Rueckgabewert bleibt trotzdem
  // die einzige Instanz, die das PRUEFT statt es vorauszusetzen.
  if (persistentId.empty()) {
    if (interessant) {
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): Zoom liefert fuer diesen Gast KEINE persistentId - ein Abo kann ihn "
              L"nicht wiedererkennen. Das ist eine Eigenschaft des Gast-Kontos, "
              L"keine Entscheidung dieser Bruecke.");
    }
    return;
  }

  // ERST SUCHEN, DANN UMHAENGEN - in zwei getrennten Schritten. extract()
  // mitten in der Schleife wuerde den Laufzeiger ungueltig machen. Der
  // ZEIGER auf das gefundene Sub wird gleich mitgenommen: ein spaeteres
  // zweites Nachschlagen (find()/operator[]) muesste entweder erneut auf
  // "gefunden" pruefen oder es voraussetzen - und operator[] legte bei einem
  // Irrtum stillschweigend ein leeres Abo an.
  unsigned int alteId = 0;
  Sub* s = nullptr;
  for (const auto& [id, sub] : g_subs) {
    if (id != userId && sub->persistentId == persistentId) { alteId = id; s = sub.get(); break; }
  }
  if (s == nullptr) {
    // Der dritte stille Weg, und der einzige, der auf UNS zeigt: der Gast hat
    // eine persistentId, sie passt nur zu keinem Abo. Entweder war er nie
    // abonniert (der Normalfall in einem grossen Meeting), oder Zoom vergibt
    // ihm ueber den Wiederbeitritt hinweg eine ANDERE - dann traegt der Name
    // "persistent" nicht, und das waere ein echter Befund.
    if (interessant) {
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): hat eine persistentId, aber kein Abo fuehrt dieselbe - kein Umhaengen.");
      // DIE ZWEITE ERKLAERUNG AUSSCHLIESSEN: "zwei verschiedene Werte" und
      // "derselbe Wert, von uns verstuemmelt" fuehren beide hierher. Ein
      // Fingerabdruck (Anfang + Laenge) unterscheidet sie, ohne die Kennung
      // selbst ins Protokoll zu schreiben - sie identifiziert ein
      // Zoom-Konto und gehoert darum nicht vollstaendig in eine Logzeile.
      emitLog(L"  neu:  " + fingerprint(persistentId));
      for (const auto& [id, sub] : g_subs) {
        emitLog(L"  Abo " + std::to_wstring(id) + L": " + fingerprint(sub->persistentId));
      }
    }
    return;
  }

  // ERST DER SDK-TEIL, DANN DIE KARTE (Reihenfolge GEAENDERT, Abschluss-
  // Sichtung I1): scheitert das Umhaengen, ist die Karte dann noch voellig
  // unangetastet - es gibt nichts zurueckzurollen, und es kann auch kein
  // zweiter, nie erreichbarer Wiedereinfuege-Zweig entstehen, dessen
  // Rueckgabewert wieder jemand pruefen muesste.
  SDKError anErr = SDKERR_SUCCESS;
  if (s->renderer) {
    // ERST abmelden: das alte Abo haengt noch an der TOTEN Kennung. Ein
    // subscribe() auf einen bereits abonnierten Renderer liefert einen
    // SDK-Fehler statt umzuschalten. Ein Fehlschlag HIER ist fuer sich noch
    // keine Protokolltatsache (das folgende subscribe() sagt, ob das
    // Umhaengen trotzdem gelingt) - er geht darum als Klartext an den
    // Menschen, statt einen zweiten Ereignisnamen zu erfinden.
    logSdkError(L"unSubscribe() beim Umhaengen", s->renderer->unSubscribe());
    anErr = s->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  }
  if (anErr != SDKERR_SUCCESS) {
    // DER RUECKGABEWERT WIRD GEPRUEFT, NICHT VERWORFEN (Abschluss-Sichtung
    // I1). Vorher stand hier direkt danach emitVideo(subscribed/rebound) -
    // eine Behauptung ueber etwas, das nicht stattgefunden hat: das Abo
    // haenge an der neuen Kennung. Tatsaechlich haengt der Renderer nach
    // einem gescheiterten subscribe() an GAR NICHTS mehr (das unSubscribe()
    // darueber ist durch), es kaeme nie wieder ein Bild, und der Herzschlag
    // hielte die Quelle auf "subscribed" fest - fuer immer, ohne ein
    // einziges berichtigendes Ereignis. Derselbe SDK-Ruf wird in
    // videoSubscribe() als videoRendererFailed gemeldet; ein zweiter Umgang
    // mit demselben Aufruf waere ein Widerspruch im eigenen Haus.
    logSdkError(L"subscribe() beim Umhaengen", anErr);
    emitVideoError("videoRendererFailed");
    // WAS MIT DEM ABO GESCHIEHT - und warum: es BLEIBT bestehen, unveraendert
    // unter der ALTEN Kennung. Drei Gruende, in dieser Rangfolge:
    //   1. Die NDI-Quelle darf im Livebetrieb nicht wegbrechen (Spec
    //      Abschnitt 3). Laege sie auf Programm, risse sie weg - und zwar
    //      wegen eines Fehlers, der mit dem Bild nichts zu tun hat.
    //   2. Die Buchfuehrung des Aufrufers bleibt gueltig. Haetten wir hier
    //      auf die NEUE Kennung umgeschluesselt, waere das Abo unter einer
    //      Kennung erreichbar, die der Aufrufer nie erfahren hat (das
    //      "rebound"-Ereignis unterbleibt ja gerade) - sein
    //      videoUnsubscribe(alteKennung) liefe danach ins Leere, und das Abo
    //      waere nicht mehr abbaubar.
    //   3. Es kann sich SELBST erholen: kommt derselbe Gast noch einmal
    //      wieder (erneutes onUserJoin mit derselben persistentId), findet
    //      diese Funktion dasselbe Abo erneut und versucht das Umhaengen ein
    //      weiteres Mal.
    // state/reason bleiben absichtlich auf ihrem letzten GEMESSENEN Stand
    // (nach einem Weggang: black/participantLeft) - der Zustand, den die
    // Quelle tatsaechlich zeigt. Ein neuer reason-Wert fuer "das Umhaengen
    // ist gescheitert" waere eine Protokollerweiterung; der Fehler steht
    // benannt auf der Leitung, das genuegt.
    return;
  }

  // KEIN neues Sub bauen: der Delegate haelt einen ROHEN Zeiger auf dieses
  // Objekt (owner_ in Delegate, gesetzt in videoSubscribe()). extract() zieht
  // nur den KNOTEN samt unique_ptr aus der Map - das Sub-Objekt bleibt an
  // seiner Adresse stehen, der Delegate-Zeiger bleibt gueltig. Ein
  // erase()+neues Sub liesse den Delegate eines noch laufenden Renderers auf
  // freigegebenen Speicher zeigen.
  auto knoten = g_subs.extract(alteId);
  s->userId = userId;
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    // DERSELBE Sender bleibt bestehen - fuer den Switcher ist nichts
    // passiert, was er merken muesste. state UND lastFrameMs werden
    // ZUSAMMEN zurueckgesetzt: ein Abo, das noch nie ein Bild gesehen hat
    // (lastFrameMs == 0), haelt videoTick() bewusst auf "subscribed" statt
    // es als "cameraOff" zu melden (Aufgabe 5). Bliebe state hier auf einem
    // alten Wert wie "live" stehen, wuerde ein umgehaengtes Abo dauerhaft
    // einen Zustand behaupten, der nicht mehr gilt, ohne dass je ein
    // berichtigendes Ereignis kaeme.
    s->state = "subscribed";
    s->reason = "rebound";
    s->lastFrameMs = 0;
    s->gemessen = false;
    s->mismatchGemeldet = false;
    // Das Merkzeichen aus videoParticipantLeft() faellt hier - und NUR hier
    // sowie beim Neuanlegen eines Abos: die Person ist nachweislich wieder
    // da, das Abo haengt an ihrer neuen Kennung, Bilder duerfen ab jetzt
    // wieder "live" bedeuten.
    s->teilnehmerWeg = false;
  }
  // Zwischen dem geglueckten subscribe() oben und dieser Sperre kann bereits
  // ein Bild eintreffen. Es wird dann noch mit teilnehmerWeg == true
  // verworfen (siehe Delegate::onRawDataFrameReceived) - ein einzelnes
  // ausgelassenes Bild, kein falscher Bericht. Die Gegenrichtung waere
  // schlimmer: erst die Felder zuruecksetzen und dann subscribe() scheitern
  // sehen hiesse, ein Abo mit "subscribed"/"rebound" zurueckzulassen, das an
  // nichts haengt.
  knoten.key() = userId;
  // Rueckgabewert PRUEFEN statt verwerfen (Nachbesserung Runde 1, Befund 2):
  // schluege insert() fehl (userId waere selbst bereits ein Schluessel in
  // g_subs), gaebe der Aufruf den Knoten unveraendert in ergebnis.node
  // zurueck. Ihn dort einfach verwerfen liesse (ergebnis.node) sofort ausser
  // Sichtweite zerstoert werden - MIT dem gerade oben umsubscribe()-ten
  // Renderer und seinem Delegate, waehrend dieser Renderer noch aktiv auf
  // "userId" haengt. Das Abo waere STILL weg, ohne jedes Ereignis, und der
  // Delegate-Zeiger eines gerade noch laufenden Renderers zeigte anschliessend
  // ins Leere - genau die Gefahr, vor der der Kommentar oben (KEIN neues Sub
  // bauen) bereits warnt, nur von der anderen Seite.
  auto ergebnis = g_subs.insert(std::move(knoten));
  if (!ergebnis.inserted) {
    // Nach heutigem Aufbau praktisch unerreichbar (eine frisch beigetretene
    // Kennung hat noch kein eigenes Abo) - trotzdem sauber abbauen, GENAU wie
    // videoUnsubscribe() es tut, statt den verwaisten Knoten kommentarlos
    // auslaufen zu lassen.
    Sub* verwaist = ergebnis.node.mapped().get();
    if (verwaist->renderer) {
      logSdkError(L"unSubscribe() am verwaisten Knoten beim Umhaengen", verwaist->renderer->unSubscribe());
      logSdkError(L"destroyRenderer() am verwaisten Knoten beim Umhaengen", destroyRenderer(verwaist->renderer));
    }
    verwaist->sender.close();
    // DIESELBE Ursache wie ein direktes videoSubscribe auf eine bereits
    // belegte Kennung: "userId" hat in beiden Faellen bereits ein Abo. Kein
    // neuer Katalogeintrag noetig - videoAlreadySubscribed traegt schon
    // genau diese Bedeutung.
    emitVideoError("videoAlreadySubscribed");
    return;
  }
  emitVideo(*s, "subscribed", "rebound");
}

namespace {

void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  if (!data || !owner_) return;
  // ABBAU SCHLAEGT ALLES - siehe imAbbau am Feld. Am Status-Rueckruf ist das
  // Fenster GEMESSEN; hier ist es dasselbe Fenster mit demselben Ausgang, nur
  // laute: ein Bild, das nach dem "unsubscribed" eintrifft, meldete "live"
  // ueber ein Abo, das gerade abgebaut wird, und schriebe es zusaetzlich noch
  // in einen Sender, der gleich zugeht.
  if (owner_->imAbbau.load()) return;

  // WEGGEGANGEN SCHLAEGT BILD (Abschluss-Sichtung, I3). videoParticipantLeft()
  // laeuft auf dem Hauptthread und hat dieses Abo soeben auf
  // black/participantLeft gesetzt; dieser Rueckruf hier kann zu genau diesem
  // Zeitpunkt schon unterwegs gewesen sein. Ohne diese Abfrage schriebe er
  // danach live/frames darueber - fuer jemanden, der nachweislich weg ist -,
  // und der Herzschlag machte daraus 200 ms spaeter black/cameraOff. Der
  // Endstand waere "Kamera aus" statt "Teilnehmer weg": zwei Ursachen, ein
  // Name.
  //
  // Das Bild wird dabei GANZ verworfen, nicht bloss der Zustandswechsel
  // unterdrueckt: die Quelle meldet "black", und dann soll dort auch Schwarz
  // stehen. Ein einzelnes echtes Bild zwischen lauter Schwarzbildern waere
  // genau der Widerspruch zwischen Meldung und Bild, den Abschnitt 3 der
  // Spec ausschliesst. lastFrameMs bleibt aus demselben Grund unberuehrt -
  // sonst setzte der Nachlauf des Herzschlags 200 ms lang aus.
  {
    std::lock_guard<std::mutex> lock(owner_->fieldMutex);
    if (owner_->teilnehmerWeg) return;
  }

  const int w = static_cast<int>(data->GetStreamWidth());
  const int h = static_cast<int>(data->GetStreamHeight());
  const uint8_t* buf = reinterpret_cast<const uint8_t*>(data->GetBuffer());

  // DER PUFFER WIRD GEPRUEFT, NICHT GEGLAUBT. NDI erwartet die drei Ebenen
  // ZUSAMMENHAENGEND (Y, dann U, dann V) in EINEM Puffer - GetBuffer()
  // verspricht genau das, aber ein Zeilenabstand mit Auffuellung oder eine
  // andere Anordnung wuerde ein Bild erzeugen, das wie ein Kameradefekt
  // aussieht. Man suchte dann am falschen Ende.
  const size_t erwartet = static_cast<size_t>(w) * h * 3 / 2;
  if (!buf || w <= 0 || h <= 0 || data->GetBufferLen() != erwartet) {
    // EINMAL je Abo, nicht je Bild: 30 Meldungen je Sekunde ertraenkten
    // jede andere Ausgabe. Lesen UND Setzen von mismatchGemeldet gehoeren
    // unter DIESELBE Sperre, sonst koennten zwei Rueckrufe kurz
    // hintereinander beide "false" lesen und beide melden.
    bool sollMelden = false;
    {
      std::lock_guard<std::mutex> lock(owner_->fieldMutex);
      if (!owner_->mismatchGemeldet) {
        owner_->mismatchGemeldet = true;
        owner_->reason = "bufferMismatch";
        sollMelden = true;
      }
    }
    if (sollMelden) emitVideoError("videoBufferMismatch");
    return;   // das Abo bleibt bestehen und faellt ueber den Herzschlag auf Schwarz
  }

  // Werte JETZT aus dem Bild ziehen, dann OHNE Sperre senden - sendI420()
  // kann blockieren, bis NDI den Puffer ausgelesen hat, und die Sperre auf
  // fieldMutex darf dabei nicht gehalten werden (siehe Kommentar am Feld).
  const ULONGLONG now = GetTickCount64();
  const unsigned int rot = data->GetRotation();
  const bool limited = data->IsLimitedI420();

  owner_->sender.sendI420(buf, w, h);

  // Erst beim ERSTEN brauchbaren Bild sind rotation und limitedRange
  // gemessen - vorher waeren sie erfunden.
  bool sollEmitLive = false;
  {
    std::lock_guard<std::mutex> lock(owner_->fieldMutex);
    // ZWEITE Abfrage desselben Merkzeichens - und die TRAGENDE: zwischen der
    // ersten (ganz oben) und dieser Sperre liegt sendI420(), das blockieren
    // kann, bis NDI den Puffer ausgelesen hat. GENAU in dieses Fenster faellt
    // der Weggang, gegen den I3 sichert. Die erste Abfrage spart nur die
    // Arbeit, die zweite haelt den Bericht gerade.
    if (!owner_->teilnehmerWeg) {
      owner_->lastFrameMs = now;
      owner_->lastW = w;
      owner_->lastH = h;
      // "|| owner_->reason != \"frames\"" ist der Zusatz aus der
      // Abschluss-Sichtung (I2) und behebt einen KLEBENDEN bufferMismatch:
      // der Mismatch-Zweig oben setzt NUR reason, nicht state. Stand das Abo
      // dabei bereits auf "live" mit unveraenderter rotation/limitedRange,
      // traf keine der anderen vier Bedingungen beim naechsten GUTEN Bild zu
      // - reason blieb auf "bufferMismatch" stehen. Faellt der Strom spaeter
      // aus, meldete der Herzschlag dann black/bufferMismatch fuer eine
      // schlicht ausgeschaltete Kamera: zwei Ursachen, ein Name, und die
      // teure Richtung - man sucht im Puffer statt beim Gast. Mit diesem
      // Zusatz zieht das erste brauchbare Bild den Zustand nach UND meldet
      // die Erholung sichtbar. mismatchGemeldet bleibt dabei ABSICHTLICH
      // klebrig: die Meldung soll einmal je Abo kommen, nicht einmal je
      // Erholung.
      if (!owner_->gemessen || owner_->state != "live" || owner_->reason != "frames" ||
          owner_->rotation != rot || owner_->limitedRange != limited) {
        owner_->gemessen = true;
        owner_->rotation = rot;
        owner_->limitedRange = limited;
        owner_->state = "live";
        // Ohne diese Zeile bliebe reason nach einem vorherigen
        // bufferMismatch/cameraOff auf dem ALTEN Wert stehen, obwohl das
        // gesendete Ereignis "frames" sagt - ein spaeterer Leser (Herzschlag,
        // Aufgabe 5) saehe dann eine Ursache, die laengst nicht mehr gilt.
        owner_->reason = "frames";
        sollEmitLive = true;
      }
    }
  }
  if (sollEmitLive) emitVideoMeasured(*owner_, "live", "frames", rot, limited);
}

void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  if (!owner_) return;
  // ABBAU SCHLAEGT ALLES - siehe imAbbau am Feld. GEMESSEN: genau hier kam das
  // "black (cameraOff)" NACH dem "unsubscribed" heraus.
  if (owner_->imAbbau.load()) return;
  if (status == RawData_Off) {
    // DASSELBE Merkzeichen wie im Bild-Pfad, aus demselben Grund (I3, hier
    // fuer den zweiten Weg in denselben Zustand): videoParticipantLeft()
    // ruft unSubscribe(), und ob das SDK darauf noch ein RawData_Off
    // nachschiebt, ist aus den Kopfdateien NICHT ersichtlich. Kaeme es,
    // schriebe es "cameraOff" ueber ein bereits gemeldetes
    // "participantLeft" - derselbe falsche Endstand, nur ueber den
    // Status-Rueckruf statt ueber den Bild-Rueckruf. "Kamera aus" ist eine
    // Aussage ueber jemanden, der DA ist.
    bool sollEmit = false;
    {
      std::lock_guard<std::mutex> lock(owner_->fieldMutex);
      if (!owner_->teilnehmerWeg) {
        owner_->state = "black";
        owner_->reason = "cameraOff";
        sollEmit = true;
      }
    }
    if (sollEmit) emitVideo(*owner_, "black", "cameraOff");
  }
  // RawData_On erzeugt hier ABSICHTLICH kein Ereignis: dass das SDK Video
  // ankuendigt, heisst noch nicht, dass Bilder ankommen. "live" wird beim
  // ersten wirklich empfangenen Bild gemeldet - eine Ankuendigung ist keine
  // Messung.
}

}  // namespace
