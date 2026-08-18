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
#include "audio.h"

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
  // Der Anzeigename, wie Zoom ihn liefert - die zweite Handhabe beim
  // Umhaengen, seit gemessen ist, dass die persistentId einen Wiederbeitritt
  // nicht ueberlebt (siehe videoParticipantJoined).
  std::wstring displayName;
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

  // --- Ton ---------------------------------------------------------------
  // Ob der Aufrufer den Ton fuer dieses Abo eingeschaltet hat. Steht beim
  // Abonnieren fest (Spec Abschnitt 10: kein nachtraegliches Umschalten).
  bool audioOn = true;
  // Format des zuletzt gesehenen Pakets. 0 = noch NIE eines gesehen - dann
  // wird auch keine Stille gesendet, weil wir das Format nicht kennen und es
  // nicht erfinden. Dieselbe Regel wie lastFrameMs beim Bild.
  int audioRate = 0;
  int audioChannels = 0;
  ULONGLONG lastAudioMs = 0;
  // Bis zu welcher WANDUHRZEIT der Tonstrom dieses Abos gefuellt ist -
  // gerechnet, nicht geraten. Der Herzschlag leitet die Blockgroesse aus
  // (jetzt - silenceBisMs) ab und schiebt das Feld danach um die TATSAECHLICH
  // gesendete Zeit vor; der Rest, den die Ganzzahl-Rechnung verliert, bleibt
  // stehen und wird beim naechsten Tick mitgezaehlt. 0 = noch nie Stille
  // gesendet; dann startet der erste Stille-Tick bei lastAudioMs, damit
  // zwischen echtem Ton und Stille keine Luecke klafft. Ein eigenes Feld und
  // nicht lastAudioMs mitbenutzt: lastAudioMs ist eine MESSUNG (wann kam
  // zuletzt ein echtes Paket), silenceBisMs eine BUCHFUEHRUNG (wieviel haben
  // wir gesendet) - zwei Tatsachen, zwei Namen.
  ULONGLONG silenceBisMs = 0;
  std::string audioState = "off";     // waiting | live | silent | off
  bool audioMismatchGemeldet = false;
  // --- Messung: wieviel Ton kommt WIRKLICH an? -----------------------------
  // Zwei offene Fragen haengen an derselben Zahl: Abnahmepunkt 8 (welches
  // Format und welche Ankunftsrate Zoom liefert - steht in keinem Header) und
  // die Auslegung der Warteschlange in audio.cpp, die bisher auf einer
  // Annahme steht. Gemessen wird EINMAL je Abo ueber die erste volle Sekunde
  // und dann nie wieder: eine Zeile je Sekunde je Abo waere Laerm, und die
  // Frage ist nach einer Sekunde beantwortet.
  ULONGLONG audioMessBeginnMs = 0;
  unsigned int audioMessPakete = 0;
  unsigned long long audioMessAbtastwerte = 0;
  // FENSTERZAEHLER statt eines einmaligen "schon gemeldet" (18.08.2026): die
  // erste Messung deckte nur die erste Sekunde NACH dem ersten Paket ab, also
  // den Anlauf - und ausgerechnet dort log sie 149 % der Rate und 477 ms
  // Wartezeit, waehrend fruehere Laeufe 100 % zeigten. Eine einmalige Messung
  // im unrepraesentativsten Moment kann nicht zwischen "Rueckstau beim Start"
  // und "dauerhafter Rueckstand" unterscheiden - und genau diese Frage
  // entscheidet, was gegen den Bild-Ton-Versatz zu tun ist. Erstes Fenster
  // 1 s (fruehe Rueckmeldung), danach je 10 s (Dauerbetrieb).
  unsigned int audioMessFenster = 0;
  // WARTEZEIT IN DER WARTESCHLANGE, in Mikrosekunden. Das ist der VOLLE
  // Vorsprung, den das Bild vor dem Ton hat: das Bild geht direkt aus seinem
  // SDK-Rueckruf raus, der Ton wartet bis zum naechsten videoTick().
  // Abnahmepunkt 5 (Lippensynchronitaet) ist am 18.08.2026 gefallen, mit
  // GLEICHBLEIBENDEM Versatz - diese Zahl sagt, wieviel davon UNSER Anteil
  // ist. Faellt sie klein aus, liegt der Rest bei Zoom oder beim Empfaenger,
  // und kein Umbau dieser Warteschlange wuerde daran etwas aendern.
  unsigned long long audioWartenSummeUs = 0;
  unsigned long long audioWartenMaxUs = 0;
  unsigned long long audioWartenMinUs = 0;   // 0 = noch nichts gemessen
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

// Wie emitVideo(), aber fuer den Ton - und mit derselben Regel: sampleRate und
// channels stehen NUR dabei, wenn ein Paket sie geliefert hat. Eine erfundene
// 32000 liesse sich spaeter nicht von einer gemessenen unterscheiden.
void emitAudio(const Sub& s, const char* state, const char* reason) {
  std::string out = std::string("{\"ev\":\"audio\",\"id\":") + std::to_string(s.userId.load()) +
                    ",\"state\":\"" + state + "\",\"reason\":\"" + reason + "\"";
  if (s.audioRate > 0) {
    out += ",\"sampleRate\":" + std::to_string(s.audioRate) +
           ",\"channels\":" + std::to_string(s.audioChannels);
  }
  out += "}";
  emitRaw(out);
}

void emitVideoError(const char* code) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code + "\"}");
}

// MIT KENNUNG (Owner-Lauf 18.08.2026): dort stand
// "FEHLER bei video: VIDEO_UNKNOWN_PARTICIPANT" neben ZWEI abonnierten
// Kennungen, und welche der beiden gemeint war, stand nirgends. Bei fuenf
// Abos - der festgelegten Betriebsgroesse - ist das nicht mehr zu erraten.
// Ein Fehler, der sein Abo nicht nennt, laesst sich keinem Abo zuordnen; fuer
// einen Aufrufer, der eine Karte fuehrt (src/state.ts), ist er damit gar
// nicht verwertbar - dieselbe Luecke, die beim audio-Ereignis schon einmal
// zugemacht wurde.
//
// KEINE Ueberladung fuer die zwei Stellen in main.cpp, an denen
// parseParticipantId() scheitert: dort ist gar KEINE Kennung bekannt. Eine
// erfundene 0 waere schlimmer als keine - sie sieht aus wie eine Angabe.
void emitVideoError(const char* code, unsigned int userId) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code +
          "\",\"id\":" + std::to_string(userId) + "}");
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

void videoSubscribe(unsigned int userId, ZoomSDKResolution res, bool audioOn) {
  if (g_subs.count(userId)) { emitVideoError("videoAlreadySubscribed", userId); return; }
  // Die Erlaubnis ist Voraussetzung, kein Wunsch (siehe Spec Abschnitt 5).
  if (!sessionCanRecordRaw()) { emitVideoError("videoNoPrivilege", userId); return; }

  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) {
    emitVideoError("videoUnknownParticipant", userId);
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
    emitVideoError("videoRawRecordingFailed", userId);
    return;
  }

  auto sub = std::make_unique<Sub>();
  sub->userId = userId;
  sub->persistentId = persistentId;
  // ROH mitfuehren, nicht aus source zurueckrechnen: source traegt Praefix und
  // ggf. einen Kollisionszusatz " (2)" - daraus den Namen wiederzugewinnen
  // waere Ratearbeit an einer Stelle, an der ein Irrtum die falsche Person auf
  // Sendung braechte.
  sub->displayName = name;
  sub->res = res;
  sub->audioOn = audioOn;
  sub->source = uniqueSourceName(name);
  sub->delegate = std::make_unique<Delegate>(sub.get());

  if (!sub->sender.open(sub->source)) { emitVideoError("videoSenderFailed", userId); return; }

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
    emitVideoError("videoRendererFailed", userId);
    return;
  }
  sub->renderer->setRawDataResolution(res);
  err = sub->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  if (err != SDKERR_SUCCESS) {
    logSdkError(L"subscribe() beim Anlegen des Abos", err);
    destroyRenderer(sub->renderer);
    sub->sender.close();
    emitVideoError("videoRendererFailed", userId);
    return;
  }

  Sub* raw = sub.get();
  g_subs[userId] = std::move(sub);
  emitVideo(*raw, "subscribed", "command");

  // Der Ton-Schalter wird IMMER gemeldet, auch wenn er aus ist: ein Abo ohne
  // Ton-Zeile saehe genauso aus wie eines, dessen Ton nur noch nicht
  // angekommen ist. Zwei Zustaende, eine Stille - genau das schliesst die
  // Kernregel aus.
  //
  // NACH emitVideo("subscribed") (Owner-Ruling R12, weicht vom urspruenglichen
  // Brief-Wortlaut "unmittelbar davor" ab): das Ton-Ereignis sagt etwas UEBER
  // ein Abo, die Video-Zeile ist die, die dieses Abo erst bekannt macht und
  // seine NDI-Quelle benennt. Zuerst die untergeordnete Tatsache zu senden
  // haette einem Leser der Rohausgabe eine Aussage ueber eine id in die Hand
  // gegeben, von der er noch nichts weiss.
  if (audioOn) {
    if (audioEnsureSubscribed()) {
      raw->audioState = "waiting";
      emitAudio(*raw, "waiting", "command");
    } else {
      // audioEnsureSubscribed() hat die Ursache bereits benannt (auf stdout,
      // ohne id - siehe audio.cpp). Das BILD-Abo bleibt bestehen - ein
      // fehlender Ton ist kein Grund, die Quelle wegzunehmen.
      //
      // EIGENER GRUND "audioUnavailable", NICHT "command" (Nachbesserung,
      // Review Task 5): "command" heisst hier eigentlich "der Aufrufer hat
      // den Ton ausgeschaltet" (siehe der else-Zweig unten) - dieser Zweig
      // aber laeuft genau dann, wenn der Aufrufer Ton WOLLTE und das SDK ihn
      // verweigert hat. Beide auf "command" zu melden waere byte-identisch
      // fuer zwei verschiedene Ursachen gewesen, unterscheidbar nur ueber ein
      // begleitendes error-Ereignis OHNE id - fuer einen Konsumenten also gar
      // nicht zuordenbar. Zwei Ursachen, ein Name: genau das schliesst die
      // Kernregel aus.
      raw->audioOn = false;
      raw->audioState = "off";
      emitAudio(*raw, "off", "audioUnavailable");
    }
  } else {
    emitAudio(*raw, "off", "command");
  }
}

void videoUnsubscribe(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) { emitVideoError("videoNotSubscribed", userId); return; }
  Sub* s = it->second.get();
  // VOR der Meldung, nicht danach: zwischen emitVideo() und unSubscribe()
  // liegt ein Fenster, in dem ein Rueckruf noch etwas ueber dieses Abo sagen
  // koennte - und alles, was er dann sagt, kaeme NACH "unsubscribed".
  s->imAbbau = true;
  if (s->audioOn) emitAudio(*s, "off", "command");
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
// ABBAU-MARKEN AUF stderr (Owner-Lauf 18.08.2026): der Prozess ist nach
// "Status: ended (vom Gastgeber beendet)" mit exitCode 3221225477 = 0xC0000005
// = STATUS_ACCESS_VIOLATION gestorben. Wo genau, sagte nichts - zwischen der
// letzten Protokollzeile und dem Prozessende lagen vier SDK-Aufrufe, ein
// NDI-Aufruf und ein clear(), das JEDES Sub samt fieldMutex zerstoert
// (Befund I6, seit Stage 2 ausdruecklich als UNBELEGT vermerkt).
//
// emitLog() spuelt stderr selbst (emit.cpp) - die zuletzt gedruckte Marke
// steht also auch dann noch da, wenn der naechste Aufruf den Prozess
// umbringt. Bei einem Absturz ist sie die EINZIGE Auskunft, die es je geben
// wird; ein Messgeraet, das mit dem Gemessenen stirbt, misst nichts.
//
// DIE MARKE NACH clear() IST DIE WICHTIGSTE: druckt sie noch und der Prozess
// stirbt trotzdem, dann liegt der Fehler NICHT in diesen Aufrufen, sondern in
// einem SPAETEREN Rueckruf, der auf ein bereits zerstoertes Sub trifft - also
// genau in I6. Bleibt sie aus, benennt die letzte gedruckte Marke die Zeile.
// "sdkAbmelden" TRENNT ZWEI LAGEN, die vorher denselben Weg nahmen:
//
//   true  - das Meeting LEBT noch (leave/quit/EOF). Der Renderer ist gueltig,
//           unSubscribe()/destroyRenderer() gehoeren gerufen, sonst bleibt ein
//           Abo im SDK stehen.
//   false - das Meeting ist ZU ENDE. GEMESSEN am 18.08.2026, zweimal: ein
//           unSubscribe() auf den Renderer beendet den Prozess mit
//           0xC0000005 - aus dem Rueckruf heraus UND, nach dem ersten
//           Behebungsversuch, ebenso von main() aus. Re-Entranz war es also
//           nicht; das SDK hat seine Rohdaten-Einrichtung zu diesem Zeitpunkt
//           bereits abgeraeumt, und der Zeiger zeigt ins Freigegebene. Der
//           Ton-Helfer sagt an derselben Stelle dasselbe, nur hoeflicher: sein
//           unSubscribe() antwortet SDKERR_WRONG_USAGE (2) statt abzustuerzen.
//
// AUCH destroyRenderer() FAELLT WEG, und das ist eine ABWAEGUNG, keine
// Messung: ob es den Aufruf ueberlebt haette, ist UNGEPRUEFT. Ihn zu
// versuchen haette einen weiteren Absturz gekostet, um es zu erfahren. Der
// Preis der Unwissenheit ist ein moeglicherweise liegengelassener Renderer je
// Meeting - bei hoechstens fuenf Abos (die festgelegte Betriebsgroesse) eine
// bekannte, begrenzte Menge. Und sehr wahrscheinlich gar keine: dass
// unSubscribe() abstuerzt, heisst ja gerade, dass das SDK das Ding schon
// weggeraeumt hat. Wer es spaeter messen will, setzt destroyRenderer() mit
// einer Marke davor wieder ein.
static void videoAbbauAlle(const char* reason, bool sdkAbmelden) {
  const std::wstring grundW(reason, reason + std::char_traits<char>::length(reason));
  emitLog(L"Abbau beginnt (" + grundW + L"), " + std::to_wstring(g_subs.size()) +
          L" Abo(s), SDK abmelden: " + (sdkAbmelden ? L"ja" : L"nein - Meeting ist zu Ende"));
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
    // Der Ton endet mit dem Abo und meldet sich EIGENS: ein Aufrufer, der
    // audioSubs fuehrt (src/state.ts), behielte sonst einen Eintrag, auf den
    // nie wieder ein Ereignis kommt - dieselbe Karteileiche, die beim Bild
    // schon einmal aufgetreten ist.
    if (s->audioOn) emitAudio(*s, "off", reason);
    emitVideo(*s, "unsubscribed", reason);
    // DIESELBE unbelegte Lebensdauer-Annahme wie in videoUnsubscribe() -
    // siehe den ausfuehrlichen Kommentar dort (Abschluss-Sichtung, I6): das
    // g_subs.clear() unten zerstoert jedes Sub samt fieldMutex, waehrend der
    // Delegate einen rohen Zeiger darauf haelt.
    if (s->renderer && sdkAbmelden) {
      emitLog(L"Abbau " + std::to_wstring(id) + L": unSubscribe()");
      logSdkError(L"unSubscribe() beim Gesamtabbau", s->renderer->unSubscribe());
      emitLog(L"Abbau " + std::to_wstring(id) + L": destroyRenderer()");
      logSdkError(L"destroyRenderer() beim Gesamtabbau", destroyRenderer(s->renderer));
    } else if (s->renderer) {
      emitLog(L"Abbau " + std::to_wstring(id) +
              L": Renderer NICHT angefasst - das Meeting ist zu Ende, das SDK hat ihn schon abgeraeumt");
    }
    // Losgelassen, nicht abgebaut: der Zeiger zeigt ab hier moeglicherweise
    // ins Freigegebene, und nichts darf ihn spaeter noch fuer gueltig halten.
    // Das Sub verschwindet gleich ohnehin (clear() unten) - die Zeile steht
    // fuer den Fall, dass dieser Abbau je woanders hinwandert.
    s->renderer = nullptr;
    emitLog(L"Abbau " + std::to_wstring(id) + L": NDI-Sender schliessen");
    s->sender.close();
    emitLog(L"Abbau " + std::to_wstring(id) + L": fertig");
  }
  emitLog(L"Abbau: Karte leeren - ab hier sind alle Sub-Objekte zerstoert");
  g_subs.clear();
  emitLog(L"Abbau fertig, Karte ist leer");
}

// Meeting LEBT noch (leave/quit/EOF) - das SDK gehoert ordentlich abgemeldet.
void videoShutdownAll() {
  videoAbbauAlle("command", true);
}

void videoMeetingEnded() {
  // GEMESSEN im Owner-Lauf vom 2026-08-13: nach "Status: ended (vom Gastgeber
  // entfernt)" blieb das Abo bestehen. Der Herzschlag schickte weiter
  // Schwarzbilder in eine NDI-Quelle, deren Meeting es nicht mehr gab - und
  // der letzte gemeldete Stand war "black (cameraOff)", also "jemand hat die
  // Kamera aus" fuer eine beendete Sitzung. Zwei Ursachen, ein Name.
  //
  // ⚑ WIDERRUFEN am 18.08.2026. Hier stand: "WARUM DER ABBAU HIER SICHER IST,
  // und zwar gemessen statt gehofft" - in jenem Lauf sei videoShutdownAll()
  // nach dem "ended" durchgelaufen und habe unSubscribe()/destroyRenderer()
  // auf Renderer eines beendeten Meetings gerufen, ohne Absturz.
  //
  // Der Satz war wahr und trug trotzdem nicht. Gemessen wurde ein ANDERER
  // AUFRUFORT: videoShutdownAll() lief aus main(), also NACH Rueckkehr aus
  // dem Rueckruf. videoMeetingEnded() wurde spaeter aus
  // onMeetingStatusChanged gerufen - INNERHALB von pumpOnce() -, und die
  // Begruendung wanderte mit, ohne dass jemand nachmass. Von dort aus
  // beendete unSubscribe() den Prozess mit 0xC0000005.
  //
  // "Derselbe Aufruf zum selben Zeitpunkt, nur ohne den Umweg ueber den
  // Aufrufer" - genau dieser Umweg WAR der Unterschied. Der Aufrufort ist
  // Teil der Messung, nicht Beiwerk.
  //
  // main() ruft diese Funktion jetzt wieder von aussen (callbacks.h,
  // callbacksTakeMeetingEndTeardown) - der Aufrufort, den die Messung von
  // 2026-08-13 tatsaechlich abgedeckt hat.
  //
  // KEIN Schweigen und kein Weiterleben: ein Abo, das seine Sitzung
  // ueberlebt, ist genau der Fall, den der Kommentar an reduce() in
  // src/state.ts als den gefaehrlichen benennt.
  if (g_subs.empty()) return;
  // OHNE SDK-Abmeldung: siehe die Begruendung an videoAbbauAlle().
  videoAbbauAlle("meetingEnded", false);
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
  // JETZT VOR DEM LEEREN NEHMEN (Schlusspruefung, M13). Dauert das Leeren
  // einer vollen Warteschlange laenger als die 40-ms-Schwelle - 256
  // Sendeaufrufe nach einem Haenger sind dafuer genug -, dann liegt ein
  // danach genommenes "jetzt" so weit hinter den Abos, die FRUEH in der
  // Schleife Ton bekommen haben, dass sie im SELBEN Tick die Stille-Schwelle
  // ueberschreiten: silent/gap unmittelbar nach live/packets, fuer einen
  // Strom, der gerade laeuft.
  //
  // Der Preis dieser Reihenfolge, und darum stehen unten ueberall Vergleiche
  // statt blosser Subtraktionen: lastAudioMs/lastFrameMs koennen jetzt
  // NEUER sein als "jetzt" (die Leer-Schleife setzt lastAudioMs, der
  // SDK-Thread lastFrameMs). Eine Subtraktion liefe bei ULONGLONG unter null
  // und wuerde als riesige Spanne gelesen - genau das Gegenteil der Absicht.
  const ULONGLONG jetzt = GetTickCount64();

  // ERST den Ueberlauf melden, dann leeren. Ein Ueberlauf ist eine Aussage
  // ueber die Maschine (eine Warteschlange fuer alle), nicht ueber einen Gast
  // - darum ohne id. EINMAL JE MEETING, nicht je Tick: das Merkzeichen dafuer
  // sitzt in audio.cpp (audioTakeOverflowReport), weil die Warteschlange dort
  // liegt. Und die ZAHL geht mit: audioTakeOverflowReport() weiss, wie viele
  // Pakete verlorengegangen sind - sie hier wegzuwerfen hiesse, eine Messung
  // zu nehmen und zu verschenken.
  unsigned int verworfen = 0;
  if (audioTakeOverflowReport(&verworfen)) {
    emitRaw(std::string("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioQueueOverflow\",\"dropped\":") +
            std::to_string(verworfen) + "}");
  }

  AudioPacket p;
  while (audioPop(&p)) {
    auto it = g_subs.find(p.userId);
    // Kein Abo, Ton aus, im Abbau, oder der Teilnehmer ist weg: VERWERFEN.
    // Genau dafuer gibt es den Weg ueber die Warteschlange - hier ist das
    // die richtige Antwort und kein Absturz.
    if (it == g_subs.end()) continue;
    Sub* s = it->second.get();
    // teilnehmerWeg NACHGETRAGEN (Review Task 7): dasselbe Fenster, das
    // Delegate::onRawDataFrameReceived beim Bild schon abschliesst
    // (die Sperre "if (owner_->teilnehmerWeg) return;", siehe dort, und die
    // Messung vom 2026-08-13 am Sub::teilnehmerWeg-Kommentar oben: nach
    // "unsubscribed" kam noch ein "black"/"cameraOff" hinterher). Ohne diese
    // Bedingung wuerde ein Paket, das beim Weggang schon in g_queue lag -
    // oder das Zoom noch einen Moment spaeter zustellt -, die Ton-Felder
    // ueberschreiben und "live"/"packets" melden: eine Behauptung ueber
    // einen Gast, den der Rueckruf onUserLeft schon als weg gemeldet hat,
    // ohne dass je ein zweites Weggangs-Ereignis das berichtigen wuerde.
    //
    // imAbbau IST HIER INERT, ehrlich eingeordnet (Schlusspruefung, M10) -
    // wie der Nachpruef-Vergleich im Herzschlag weiter unten, der genau das
    // vorbildlich benennt: gesetzt wird imAbbau nur in videoUnsubscribe() und
    // videoAbbauAlle(), und BEIDE loeschen das Abo aus g_subs, bevor sie
    // zurueckkehren - auf DEMSELBEN Hauptthread, der hier leert. Ein Abo, das
    // diese Zeile mit imAbbau erreichen koennte, gibt es unter der heutigen
    // Architektur nicht; ein Paket fuer ein abgebautes Abo faellt eine Zeile
    // hoeher am find() heraus. Der BILD-Rueckruf braucht denselben Riegel
    // wirklich (er laeuft auf einem SDK-Thread, siehe Sub::imAbbau) - dieses
    // Leeren nicht.
    //
    // NICHT ENTFERNEN, aus demselben Grund wie dort: die Zeile kostet ein
    // atomares Lesen und ist der Riegel fuer den Tag, an dem jemand das
    // Leeren aus dem Tick herausnimmt oder den Abbau umbaut - eine Aenderung,
    // die sich nicht von selbst meldet.
    //
    // WELCHE FELDER fieldMutex SCHUETZT, und warum diese Lesestelle anders
    // aussieht als der Herzschlag achtzig Zeilen weiter unten (M11):
    // fieldMutex schuetzt die Feldbuchfuehrung, die der BILD-Rueckruf auf dem
    // SDK-Thread gleichzeitig schreibt - state/reason (std::string, ein
    // zerrissener Zugriff waere dort nicht bloss falsch, sondern ein
    // Absturz), lastFrameMs/lastBlackMs/lastW/lastH/rotation/limitedRange/
    // gemessen/mismatchGemeldet, dazu die Tonfelder, die dieselben zwei
    // Threads spaeter einmal teilen koennten. audioOn und teilnehmerWeg
    // gehoeren NICHT dazu: beide schreibt ausschliesslich der Hauptthread
    // (videoSubscribe bzw. videoParticipantLeft/videoParticipantJoined), und
    // hier liest derselbe Hauptthread. Ein Wettrennen gibt es dafuer heute
    // nicht. Der Herzschlag unten nimmt sie trotzdem unter der Sperre mit -
    // nicht weil sie es braeuchten, sondern weil er ohnehin eine
    // Momentaufnahme ALLER Tonfelder in einem Zug zieht und ein zweites,
    // ungesperrtes Lesen daneben nur die Frage aufwuerfe, warum es zwei gibt.
    if (!s->audioOn || s->imAbbau.load() || s->teilnehmerWeg) continue;

    // GEPRUEFT, NICHT GEGLAUBT - dieselbe Sorge wie bei GetBufferLen() im
    // Bild-Rueckruf: eine Pufferlaenge, die nicht zur Kanalzahl passt, ergibt
    // Rauschen, das wie ein Mikrofondefekt klingt, nicht wie ein
    // Softwarefehler. Man sucht dann am falschen Ende.
    //
    // BERICHTIGT (Nachbesserung nach Review): hier stand
    // `p.samples.size() != sampleCount * channels` - das kann STRUKTURELL
    // NIE ansprechen. sampleCount und samples.size() entstehen in audio.cpp
    // durch DIESELBE Ganzzahl-Division derselben Rohlaenge len (sampleCount
    // = len / (2*channels), samples.size() = len / 2) und verlieren einen
    // etwaigen Rest GLEICHERMASSEN - aus den beiden Ergebnissen laesst sich
    // danach nicht mehr rekonstruieren, ob len ein ganzzahliges Vielfaches
    // von channels*2 war (bei einem Kanal sogar NIE, siehe AudioPacket::
    // bufferLen). Die Probe darum jetzt gegen bufferLen, die einzige Groesse,
    // die den Rest noch traegt und nicht schon durch dieselbe Rechnung
    // gelaufen ist wie der Wert, gegen den sie prueft.
    if (p.sampleCount <= 0 ||
        p.bufferLen % (sizeof(int16_t) * static_cast<unsigned int>(p.channels)) != 0) {
      bool melden = false;
      {
        std::lock_guard<std::mutex> lock(s->fieldMutex);
        if (!s->audioMismatchGemeldet) { s->audioMismatchGemeldet = true; melden = true; }
      }
      // MIT id, ANDERS als audioQueueOverflow oben (Review-Runde 2, Finding
      // B): audioQueueOverflow ist eine Aussage ueber die MASCHINE (eine
      // Warteschlange fuer alle) - der Rueckruf, der dort verwirft, weiss gar
      // nicht, zu welchem Abo das Paket gehoert haette, darum bleibt der
      // OHNE id richtig. audioBufferMismatch dagegen ist eine Aussage ueber
      // GENAU EIN Abo: das Merkzeichen (audioMismatchGemeldet) ist per-Abo.
      // Ohne id bekaeme der Operator eine Fehlerzeile, die sich keinem Gast
      // zuordnen liesse - fuer EIN Abo dieselbe stille Sorte Fehler, die die
      // Kernregel ausdruecklich verbietet.
      //
      // WAS DAS MERKZEICHEN TUT UND WAS NICHT (BERICHTIGT, Schlusspruefung
      // Important 7): hier stand, ab dem Ausloesen gehe "genau dieses eine
      // Abo dauerhaft still", und jedes weitere Paket falle "ab hier auf
      // denselben fruehen continue". So ist es nicht. Das continue haengt an
      // der Pufferlaenge JEDES EINZELNEN Pakets - VERWORFEN WIRD JE PAKET.
      // audioMismatchGemeldet unterdrueckt ausschliesslich die WIEDERHOLUNG
      // der Meldung - GEMELDET WIRD JE ABO EINMAL. Ein einzelnes fehlerhaftes
      // Paket kostet also genau dieses eine Paket; das naechste wohlgeformte
      // geht normal raus und setzt das Abo wieder auf live/packets. Wer die
      // alte Fassung glaubte, suchte nach einem Abo, das nie wieder sendet -
      // in die falsche Richtung.
      //
      // NICHT spaeter "vereinheitlichen":
      // die beiden Fehler haben verschiedene Ursachen (Maschine vs. ein
      // Gast) und bleiben darum absichtlich verschieden foermig.
      if (melden) {
        emitRaw(std::string("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioBufferMismatch\",\"id\":") +
                std::to_string(s->userId.load()) + "}");
      }
      continue;
    }

    // Senden OHNE Sperre - sendAudio() nimmt NdiSenders eigene Sperre.
    s->sender.sendAudio(p.samples.data(), p.sampleCount, p.sampleRate, p.channels);

    bool wurdeLive = false;
    bool messungFertig = false;
    unsigned int mPakete = 0;
    unsigned long long mWartenSumme = 0;
    unsigned long long mWartenMax = 0;
    unsigned long long mWartenMin = 0;
    bool mErstesFenster = false;
    unsigned long long mWerte = 0;
    ULONGLONG mSpanne = 0;
    int mRate = 0, mKanaele = 0;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      s->audioRate = p.sampleRate;
      s->audioChannels = p.channels;
      s->lastAudioMs = GetTickCount64();
      if (s->audioState != "live") { s->audioState = "live"; wurdeLive = true; }

      // GEZAEHLT WIRD, WAS GESENDET WURDE - direkt nach dem Sendeaufruf oben,
      // nicht was hereinkam. Die Frage lautet ja gerade, ob zwischen "kommt
      // an" und "geht raus" etwas dazukommt.
      if (s->audioMessBeginnMs == 0) s->audioMessBeginnMs = s->lastAudioMs;
      ++s->audioMessPakete;
      s->audioMessAbtastwerte += static_cast<unsigned long long>(p.sampleCount);
      // Die Frequenz EINMAL holen: sie ist zur Laufzeit unveraenderlich
      // (dokumentiert), und ein Aufruf je Paket waere bei rund 100 Paketen je
      // Sekunde und Sprecher blosse Arbeit ohne Erkenntnis.
      static const long long qpcFreq = [] {
        LARGE_INTEGER f;
        QueryPerformanceFrequency(&f);
        return f.QuadPart;
      }();
      if (p.eingangTick > 0 && qpcFreq > 0) {
        LARGE_INTEGER jetztQpc;
        QueryPerformanceCounter(&jetztQpc);
        const long long diff = jetztQpc.QuadPart - p.eingangTick;
        // VERGLEICH statt blosser Subtraktion, dieselbe Vorsicht wie beim
        // Herzschlag: ein negativer Wert waere ein Messfehler, kein Verzug,
        // und als vorzeichenlose Zahl eine gewaltige Luege.
        if (diff > 0) {
          const unsigned long long us = static_cast<unsigned long long>(diff * 1000000LL / qpcFreq);
          s->audioWartenSummeUs += us;
          if (us > s->audioWartenMaxUs) s->audioWartenMaxUs = us;
          if (s->audioWartenMinUs == 0 || us < s->audioWartenMinUs) s->audioWartenMinUs = us;
        }
      }
      const ULONGLONG spanne = s->lastAudioMs - s->audioMessBeginnMs;
      // Erstes Fenster kurz, damit frueh etwas dasteht; danach lang, damit
      // die Ausgabe im Dauerbetrieb nicht zurauscht.
      const ULONGLONG fensterMs = (s->audioMessFenster == 0) ? 1000 : 10000;
      if (spanne >= fensterMs) {
        mErstesFenster = (s->audioMessFenster == 0);
        ++s->audioMessFenster;
        messungFertig = true;
        mPakete = s->audioMessPakete;
        mWerte = s->audioMessAbtastwerte;
        mSpanne = spanne;
        mRate = s->audioRate;
        mKanaele = s->audioChannels;
        mWartenSumme = s->audioWartenSummeUs;
        mWartenMax = s->audioWartenMaxUs;
        mWartenMin = s->audioWartenMinUs;
        // FENSTER ZURUECKSETZEN, nicht fortschreiben: ein Mittelwert ueber
        // den gesamten Lauf wuerde den Anlauf-Rueckstau fuer immer
        // mitschleppen und jede spaetere Besserung verdecken.
        s->audioMessBeginnMs = s->lastAudioMs;
        s->audioMessPakete = 0;
        s->audioMessAbtastwerte = 0;
        s->audioWartenSummeUs = 0;
        s->audioWartenMaxUs = 0;
        s->audioWartenMinUs = 0;
      }
    }
    if (wurdeLive) emitAudio(*s, "live", "packets");
    if (messungFertig) {
      // DIE ENTSCHEIDENDE GEGENUEBERSTELLUNG: gesendete Abtastwerte je Sekunde
      // gegen die Abtastrate, die Zoom ANGIBT. Sind beide gleich, geben wir
      // genau weiter, was ankommt. Ist die gesendete Menge ein Vielfaches,
      // senden wir denselben Ton mehrfach - und genau so klingt ein
      // zeitversetztes Echo. Der Quotient sagt, WIE oft.
      const unsigned long long jeSekunde = mWerte * 1000ULL / (mSpanne > 0 ? mSpanne : 1);
      emitLog(std::wstring(L"Ton-Messung fuer ") + std::to_wstring(s->userId.load()) +
              (mErstesFenster ? L" [ANLAUF, nicht der Dauerbetrieb]" : L" [Dauerbetrieb]") + L": " +
              std::to_wstring(mPakete) + L" Pakete in " + std::to_wstring(mSpanne) + L" ms, " +
              std::to_wstring(mWerte) + L" Abtastwerte je Kanal = " + std::to_wstring(jeSekunde) +
              L"/s gesendet. Zoom gibt " + std::to_wstring(mRate) + L" Hz, " +
              std::to_wstring(mKanaele) + L" Kanal an.");
      // UNSER EIGENER ANTEIL AM VERSATZ, getrennt ausgewiesen. Das Bild geht
      // direkt aus seinem SDK-Rueckruf raus, der Ton wartet bis zum naechsten
      // videoTick() - diese Spanne ist der Vorsprung, den das Bild dadurch
      // bekommt. Sie steht ABSICHTLICH als eigene Zeile neben der Durchsatz-
      // Messung: die eine sagt, ob wir die richtige MENGE senden, die andere,
      // ob wir sie rechtzeitig senden. Zwei Fragen, zwei Zeilen.
      if (mPakete > 0) {
        emitLog(std::wstring(L"Ton-Wartezeit fuer ") + std::to_wstring(s->userId.load()) +
                (mErstesFenster ? L" [ANLAUF]" : L" [Dauerbetrieb]") +
                L" (Warteschlange -> Senden): mittel " + std::to_wstring(mWartenSumme / mPakete) +
                L" us, min " + std::to_wstring(mWartenMin) + L" us, max " +
                std::to_wstring(mWartenMax) + L" us. Das ist UNSER Anteil am Bild-Ton-Versatz.");
      }
      if (mRate > 0) {
        const unsigned long long soll = static_cast<unsigned long long>(mRate);
        // 10 % Toleranz: die Fenstergrenze faellt nicht auf eine Paketgrenze,
        // und die erste Sekunde beginnt mit dem ersten Paket, nicht mit dem
        // Abo. Ein DOPPELTES Senden waere 200 %, kein Grenzfall.
        if (jeSekunde > soll + soll / 10) {
          emitLog(std::wstring(L"  ACHTUNG: das ist ") +
                  std::to_wstring(jeSekunde * 100ULL / soll) +
                  L" % der angegebenen Rate - wir senden mehr Ton, als Zoom liefert.");
        } else if (jeSekunde + soll / 10 < soll) {
          emitLog(std::wstring(L"  ACHTUNG: das ist nur ") +
                  std::to_wstring(jeSekunde * 100ULL / soll) +
                  L" % der angegebenen Rate - es geht Ton verloren.");
        } else {
          emitLog(L"  Passt: gesendete Menge und angegebene Rate stimmen ueberein.");
        }
      }
    }
  }

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

    // --- Stille-Herzschlag ------------------------------------------------
    // ERST NACH DEM ERSTEN ECHTEN PAKET. Vorher sind Abtastrate und
    // Kanalzahl unbekannt, und ein erfundenes Format liesse sich spaeter
    // nicht von einem gemessenen unterscheiden - dieselbe Regel, nach der
    // ein Abo ohne je gesehenes Bild auf "subscribed" steht und nicht auf
    // "cameraOff".
    {
      int aRate, aCh;
      ULONGLONG aLast, aStilleBis;
      bool aOn, aWeg;
      {
        std::lock_guard<std::mutex> lock(s->fieldMutex);
        aRate = s->audioRate; aCh = s->audioChannels;
        aLast = s->lastAudioMs; aOn = s->audioOn;
        aWeg = s->teilnehmerWeg; aStilleBis = s->silenceBisMs;
      }
      // VERGLEICH statt blosser Subtraktion (M13): "jetzt" stammt von VOR dem
      // Leeren, aLast kann also NEUER sein als jetzt - eine Subtraktion liefe
      // bei ULONGLONG unter null und meldete eine riesige Spanne fuer einen
      // Strom, der gerade eben noch Ton bekommen hat.
      const ULONGLONG seitTon = jetzt > aLast ? jetzt - aLast : 0;
      // 40 ms Nachlauf: Zoom liefert etwa alle 10-20 ms. Der Wert ist ein
      // ANFANGSWERT, kein Messergebnis (Spec Abschnitt 6) - Abnahmepunkt 2
      // prueft mit dem Ohr, ob der Uebergang knackt.
      //
      // !aWeg NACHGETRAGEN (Review Task 7): der Ton endet mit dem Weggang -
      // anders als das Bild, das als Schwarz stehen bleibt: Stille fuer
      // jemanden, der nicht da ist, waere eine Aussage ueber eine Person,
      // die es im Meeting nicht mehr gibt. videoParticipantLeft() setzt
      // audioState zwar auf "off", loescht aber weder audioRate noch
      // lastAudioMs - das Abo soll ja auf ein Umhaengen hin weiterleben. Ohne
      // diese Bedingung erreichte der Herzschlag den naechsten Tick trotzdem
      // ueber die Schwelle, sendete Stille fuer einen nachweislich
      // abwesenden Gast und schrieb "off" mit "silent"/"gap" wieder zu -
      // ohne dass je ein zweites Weggangs-Ereignis kaeme, das das
      // berichtigen wuerde.
      if (aOn && !aWeg && aRate > 0 && aCh > 0 && seitTon >= 40) {
        // WIEVIEL STILLE: aus der VERSTRICHENEN ZEIT gerechnet, nicht aus der
        // Tick-Frist (BERICHTIGT, Schlusspruefung Important 4). Hier stand
        // `aRate / 100`, also genau 10 ms Ton je Tick, mit der Begruendung,
        // die Blockgroesse entspreche der Tick-Frist. Die Schleife ist aber
        // pumpOnce(); videoTick(); stdin lesen; Sleep(10) - die tatsaechliche
        // Frist ist IMMER groesser als 10 ms, und mit Windows'
        // Standard-Zeitgeberaufloesung von 15,6 ms deutlich groesser. Eine
        // laengere Stille lieferte damit systematisch zu wenig Ton je
        // Wanduhrzeit, um einen Betrag, den niemand gemessen hat.
        //
        // silenceBisMs sagt, bis wann der Strom gefuellt ist. Beim ERSTEN
        // Stille-Tick (oder wenn seither echter Ton kam) faengt die Rechnung
        // bei lastAudioMs an - so klafft zwischen echtem Ton und Stille keine
        // Luecke.
        ULONGLONG bis = aStilleBis > aLast ? aStilleBis : aLast;
        ULONGLONG spanne = jetzt > bis ? jetzt - bis : 0;
        // OBERGRENZE 200 ms je Tick, und der Rest wird FALLENGELASSEN, nicht
        // nachgeholt. GEWAEHLT, nicht gemessen, mit zwei Gruenden: (1) nach
        // einem langen Haenger - der Prozess lag auf Eis, die Schleife stand
        // Sekunden - waere ein einzelner Sendeaufruf ueber diese ganze Zeit
        // ein Puffer, den niemand bestellt hat (bei 48 kHz Stereo sind schon
        // 200 ms rund 38 KB), und ihn ueber die naechsten Ticks NACHZUHOLEN
        // hiesse, dem Empfaenger Stille mit dem Zwanzigfachen der Echtzeit
        // vorzusetzen: der Strom liefe dem Bild davon. (2) Stille traegt
        // keine Information - was in einem Haenger verlorengeht, ist nichts,
        // das man aufheben muesste. 200 ms ist dieselbe Groessenordnung wie
        // der Nachlauf des Schwarzbild-Herzschlags weiter unten.
        constexpr ULONGLONG kMaxStilleMs = 200;
        if (spanne > kMaxStilleMs) {
          spanne = kMaxStilleMs;
          bis = jetzt - kMaxStilleMs;
        }
        const int bloecke = static_cast<int>(spanne * static_cast<ULONGLONG>(aRate) / 1000);
        // Unter einem ganzen Abtastwert gibt es nichts zu senden - dann
        // bleibt silenceBisMs stehen und der naechste Tick rechnet die Spanne
        // erneut. (Beim ERSTEN Stille-Tick kann das nicht eintreten: dort ist
        // die Spanne mindestens die 40 ms der Schwelle.) KEIN continue an
        // dieser Stelle: darunter haengt der Schwarzbild-Herzschlag desselben
        // Abos, und der hat mit dem Ton nichts zu tun.
        if (bloecke > 0) {
          s->sender.sendSilence(bloecke, aRate, aCh);
          // Um die TATSAECHLICH gesendete Zeit vorschieben, nicht bis "jetzt":
          // was die Ganzzahl-Rechnung oben verloren hat, bleibt so stehen und
          // wird beim naechsten Tick mitgezaehlt, statt sich Tick fuer Tick
          // aufzuaddieren.
          const ULONGLONG gesendetMs =
              static_cast<ULONGLONG>(bloecke) * 1000 / static_cast<ULONGLONG>(aRate);
          bool wurdeStill = false;
          {
            std::lock_guard<std::mutex> lock(s->fieldMutex);
            s->silenceBisMs = bis + gesendetMs;
            // Momentaufnahme gegenpruefen. ANDERS als beim Schwarzbild weiter
            // unten ist dieser Vergleich unter der HEUTIGEN Architektur INERT,
            // nicht scharf: der Ton-Rueckruf (audio.cpp,
            // onOneWayAudioRawDataReceived) schreibt ausschliesslich in
            // g_queue, nie direkt in Sub-Felder. lastAudioMs/audioState
            // aendert einzig die Leer-Schleife am Kopf von videoTick() - auf
            // demselben Hauptthread, und sie ist fuer DIESEN Tick bereits
            // durchgelaufen, BEVOR diese Schleife beginnt. Waehrend
            // sendSilence() oben blockiert, kann darum nichts mehr schreiben,
            // das dieser Vergleich noch auffangen muesste - ein neu
            // eingetroffenes Paket landet nur in der Warteschlange und wird
            // erst der NAECHSTE Tick leeren. Der Bild-Rueckruf dagegen laeuft
            // auf einem echten SDK-Thread und schreibt lastFrameMs
            // GLEICHZEITIG zu videoTick() - dort greift derselbe Vergleich
            // wirklich.
            //
            // Die Pruefung bleibt trotzdem stehen, ABSICHTLICH: sie kostet
            // nichts, und sie ist die Absicherung fuer den Tag, an dem jemand
            // den Ton-Weg (wie den Bild-Weg heute) auf einen eigenen
            // Rueckruf-Thread umstellt, der Sub direkt schreibt - eine
            // Aenderung, die sich nicht von selbst meldet. NICHT als totes
            // Vergleichen entfernen: genau das waere die Bremse, die diesen
            // kuenftigen Fall auffaengt.
            if (s->lastAudioMs == aLast && s->audioState != "silent") {
              s->audioState = "silent";
              wurdeStill = true;
            }
          }
          if (wurdeStill) emitAudio(*s, "silent", "gap");
        }
      }
    }

    // 200 ms Nachlauf: bei kurzen Aussetzern soll NICHT zwischen Bild und
    // Schwarz geflackert werden. Erst danach gilt der Strom als still.
    //
    // VERGLEICH statt blosser Subtraktion, dieselbe Sorgfalt wie beim Ton
    // oben (M13): lastFrameMs schreibt der Bild-Rueckruf auf einem
    // SDK-Thread, und "jetzt" stammt seit dieser Runde von VOR dem Leeren der
    // Ton-Warteschlange - ein Bild, das dazwischen ankam, traegt also einen
    // GROESSEREN Wert als jetzt. Die alte Subtraktion lief dann unter null,
    // wurde als riesige Spanne gelesen, und dieses Abo bekam ein Schwarzbild
    // mitten in den laufenden Strom (die MELDUNG fing der Vergleich weiter
    // unten ab, das gesendete Bild nicht).
    const ULONGLONG seitBild = jetzt > lastFrameMs ? jetzt - lastFrameMs : 0;
    const ULONGLONG seitSchwarz = jetzt > lastBlackMs ? jetzt - lastBlackMs : 0;
    if (lastFrameMs != 0 && seitBild < 200) continue;
    // Hoechstens alle 100 ms, also 10 Bilder je Sekunde. Das haelt die
    // Quelle fuer jeden Empfaenger gueltig und kostet fast nichts.
    if (seitSchwarz < 100) continue;

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
  // Der Ton endet mit dem Weggang - anders als das Bild, das als Schwarz
  // stehen bleibt: Stille fuer jemanden, der nicht da ist, waere eine
  // Aussage ueber eine Person, die es im Meeting nicht mehr gibt.
  bool tonWar = false;
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    if (s->audioOn && s->audioState != "off") { s->audioState = "off"; tonWar = true; }
  }
  if (tonWar) emitAudio(*s, "off", "participantLeft");
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
  // ERST SUCHEN, DANN UMHAENGEN - in zwei getrennten Schritten. extract()
  // mitten in der Schleife wuerde den Laufzeiger ungueltig machen. Der
  // ZEIGER auf das gefundene Sub wird gleich mitgenommen: ein spaeteres
  // zweites Nachschlagen (find()/operator[]) muesste entweder erneut auf
  // "gefunden" pruefen oder es voraussetzen - und operator[] legte bei einem
  // Irrtum stillschweigend ein leeres Abo an.
  //
  // ZWEI WEGE, ZWEI NAMEN. Der erste ist die persistentId - der sichere Weg,
  // solange Zoom sie durchhaelt. Der zweite ist der Anzeigename, und er
  // greift NUR bei Eindeutigkeit (siehe unten). Welcher Weg getragen hat,
  // steht danach im reason des Ereignisses: "rebound" oder "reboundByName".
  // Ein gemeinsamer Name fuer beide waere eine Aussage weniger, als wir
  // haben - und ausgerechnet die, an der die Verlaesslichkeit haengt.
  unsigned int alteId = 0;
  Sub* s = nullptr;
  const char* grund = "rebound";

  if (!persistentId.empty()) {
    for (const auto& [id, sub] : g_subs) {
      if (id != userId && sub->persistentId == persistentId) { alteId = id; s = sub.get(); break; }
    }
  }

  if (s == nullptr) {
    // ZWEITER WEG: der Anzeigename. GEMESSEN am 14.08.2026 gegen ein echtes
    // Meeting: Zooms persistentId ist ueber einen Weggang und Wiederbeitritt
    // hinweg NICHT stabil - derselbe Gast kam mit einem anderen Wert zurueck
    // (beide 36 Zeichen, beide wohlgeformt, schlicht verschieden). Der erste
    // Weg greift fuer Gaeste damit NIE. Ohne einen zweiten Weg gaebe es das
    // Umhaengen nur auf dem Papier.
    //
    // DIE EINDEUTIGKEIT IST DER GANZE PREIS DIESER ENTSCHEIDUNG (Owner,
    // 14.08.2026). Ein Name muss auf BEIDEN Seiten genau einmal vorkommen:
    // einmal unter den Teilnehmern (sonst waeren zwei Anwesende gemeint) und
    // einmal unter den Abos (sonst waeren zwei Quellen gemeint). Zwei Gaeste,
    // die beide "Samsung SM-S931B" heissen, sind keine Ausnahme, sondern der
    // Regelfall bei Handys. Ist der Name mehrdeutig, bleibt die Quelle
    // schwarz - lieber ein Handgriff des Operators als die falsche Person auf
    // Sendung.
    const int gleichnamigeTeilnehmer = sessionCountParticipantsByName(name);
    int gleichnamigeAbos = 0;
    unsigned int kandidatId = 0;
    Sub* kandidat = nullptr;
    for (const auto& [id, sub] : g_subs) {
      if (id == userId || sub->displayName != name) continue;
      ++gleichnamigeAbos;
      kandidatId = id;
      kandidat = sub.get();
    }

    if (gleichnamigeAbos == 1 && gleichnamigeTeilnehmer == 1) {
      alteId = kandidatId;
      s = kandidat;
      grund = "reboundByName";
    } else if (interessant && gleichnamigeAbos > 0) {
      // NICHT STILL: dass ein Abo mit genau diesem Namen existiert und
      // trotzdem nichts passiert, ist der Fall, den ein Operator sonst fuer
      // einen Fehler haelt.
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): Name ist nicht eindeutig (" + std::to_wstring(gleichnamigeTeilnehmer) +
              L" Teilnehmer, " + std::to_wstring(gleichnamigeAbos) +
              L" Abos) - kein Umhaengen, die Quelle bleibt schwarz.");
    }
  }

  if (s == nullptr) {
    // Weder ueber die Kennung noch ueber den Namen. Der Normalfall in einem
    // grossen Meeting: der Gast war schlicht nie abonniert.
    if (interessant) {
      emitLog(L"Wiederbeitritt " + std::to_wstring(userId) + L" (" + name +
              L"): kein Abo gehoert zu diesem Gast - kein Umhaengen.");
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
    emitVideoError("videoRendererFailed", userId);
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
    s->reason = grund;
    // DIE NEUE KENNUNG UEBERNEHMEN. Ohne diese Zeile traegt das Abo weiter
    // die persistentId aus der VORIGEN Sitzung des Gastes - beim naechsten
    // Wiederbeitritt haette der erste Weg dann erneut keine Chance, obwohl
    // wir den aktuellen Wert laengst kennen. Beim Weg ueber den Namen ist
    // das der einzige Ort, an dem die Kennung ueberhaupt nachgezogen wird.
    s->persistentId = persistentId;
    s->displayName = name;
    s->lastFrameMs = 0;
    s->gemessen = false;
    s->mismatchGemeldet = false;
    // Das Merkzeichen aus videoParticipantLeft() faellt hier - und NUR hier
    // sowie beim Neuanlegen eines Abos: die Person ist nachweislich wieder
    // da, das Abo haengt an ihrer neuen Kennung, Bilder duerfen ab jetzt
    // wieder "live" bedeuten.
    s->teilnehmerWeg = false;
    // Das Ton-Format gilt je Sitzung des Gastes: nach einem Wiederbeitritt
    // kann Zoom ein anderes liefern. Zuruecksetzen heisst, es beim ersten
    // Paket neu zu MESSEN statt das alte fortzuschreiben.
    s->audioRate = 0;
    s->audioChannels = 0;
    s->lastAudioMs = 0;
    s->audioMismatchGemeldet = false;
    s->audioState = s->audioOn ? "waiting" : "off";
    // Auch die Messung gilt je Sitzung des Gastes - nach einem Wiederbeitritt
    // kann Zoom ein anderes Format liefern, und dann ist die alte Zahl keine
    // Aussage mehr ueber das, was jetzt kommt.
    s->audioMessBeginnMs = 0;
    s->audioMessPakete = 0;
    s->audioMessAbtastwerte = 0;
    s->audioMessFenster = 0;
    s->audioWartenSummeUs = 0;
    s->audioWartenMaxUs = 0;
    s->audioWartenMinUs = 0;
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
    emitVideoError("videoAlreadySubscribed", userId);
    return;
  }
  emitVideo(*s, "subscribed", grund);
  if (s->audioOn) emitAudio(*s, "waiting", grund);
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
    if (sollMelden) emitVideoError("videoBufferMismatch", owner_->userId.load());
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
