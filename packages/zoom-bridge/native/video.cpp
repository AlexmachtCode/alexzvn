#include "video.h"
#include <atomic>
#include <cstring>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <vector>
#include "emit.h"
#include "ndi_sender.h"
#include "rawdata/zoom_rawdata_api.h"
// rawdata_renderer_interface.h (ueber video.h) FORWARD-deklariert
// YUVRawDataI420 nur ("class YUVRawDataI420;") - die vollstaendige Klasse mit
// GetBuffer()/GetStreamWidth()/GetRotation()/IsLimitedI420() steht erst hier.
// Ohne diesen Include bricht der Bau an jeder Methode auf *data mit C2027
// ("Verwendung des undefinierten Typs") ab.
#include "zoom_sdk_raw_data_def.h"
// GetProcessMemoryInfo (bridgeStats.memMb): mit PSAPI_VERSION 2 liegt es als
// K32GetProcessMemoryInfo in kernel32 (gemessen: Bau ohne psapi, A-EP15).
#include <psapi.h>
#include "session.h"
#include "callbacks.h"
#include "audio.h"
#include "preview.h"
// Mischer Mischton + Computerton (reine Logik, Block a2). min/max wie bei slot_logic.h.
#pragma push_macro("min")
#pragma push_macro("max")
#undef min
#undef max
#include "audio_mix.h"
#pragma pop_macro("max")
#pragma pop_macro("min")

using namespace slotlogic;

namespace {

// --- Slot, Abo, Delegate (Spec 6.1) --------------------------------------------------
// THREAD-REGEL (6.1, Nachbesserung B18):
//   Hauptthread  - fuegt Slots ein und entfernt sie, ruft JEDE Renderer-Funktion
//                  (subscribe, unSubscribe, setRawDataResolution, createRenderer,
//                  destroyRenderer, nur in slotRetarget und im Abbau) und liest
//                  g_slots ohne Kartensperre.
//   SDK-Thread   - Bild-, Status- und Abbau-Rueckruf des Delegates: nur Atome, die
//                  Felder unter fieldMutex (NIE ueber einem Sendeaufruf gehalten)
//                  und die Kopie per try_lock. Fasst g_slots nie an.
//                  Seit dem Abschluss-Fix: jeder Rueckruf prueft zuerst Delegate::abgemeldet (F1);
//                  emitSlot nimmt die Ausgabe-Sperre emitMutex vor fieldMutex (F12);
//                  der Abbau-Rueckruf schreibt eine stderr-Zeile mit der Slot-Nummer (F1, Abnahme).
//                  F15: jeder Rueckruf zaehlt sich ZUERST in die Wache seines Delegates (RueckrufImFlug)
//                  und prueft DANN abgemeldet. Bevor der Hauptthread einen Slot freigibt, meldet er
//                  jeden Delegate des Slots ab und wartet OHNE gehaltene Sperre, bis keiner mehr im
//                  Flug ist - hoechstens RUECKRUF_FRIST_MS, sonst bleibt der Slot bis Prozessende.
// Auf welchem Thread das SDK die Delegate-Rueckrufe ruft, sagt kein Header (heute nur
// Kommentar, E15); die Regel traegt beide Faelle.

struct Slot;
struct Abo;

class Delegate : public IZoomSDKRendererDelegate {
 public:
  Delegate(Slot* slot, Abo* abo, int nr) : slot_(slot), abo_(abo), nr_(nr) {}
  void onRendererBeDestroyed() override;
  void onRawDataFrameReceived(YUVRawDataI420* data) override;
  void onRawDataStatusChanged(RawDataStatus status) override;

  // Abgemeldet (Abschluss-Fix F1, Abschlusspruefung I-1): gesetzt, bevor die Bridge den Renderer dieses Delegates verwirft
  // oder abbaut oder seinen Slot loescht. Jeder der drei Rueckrufe prueft es ZUERST und fasst danach weder Slot noch Abo
  // an. Der Delegate selbst lebt bis zum Prozessende (g_delegates); seine Zeiger slot_/abo_ duerfen dann tot sein.
  // Seit F15 (Sicherheitspruefung, TOCTOU) ist der Merker Teil der Wache: Zaehler imFlug plus abgemeldet (slot_logic.h,
  // Dekker, seq_cst). Ein Rueckruf zaehlt sich ZUERST (RueckrufImFlug) und prueft DANN; vor dem Freigeben eines Slots
  // meldet der Hauptthread ab und wartet, bis kein Rueckruf mehr im Flug ist (slotFreigabeAbwarten).
  RueckrufWache wache;
  bool zeigtAuf(const Slot* s) const { return slot_ == s; }

 private:
  Slot* slot_;
  Abo* abo_;
  int nr_;   // Slot-Nummer, nur fuer die stderr-Zeile von onRendererBeDestroyed (ohne den Slot anzufassen)
};

// Ein Abo = Renderer, Delegate, Ziel, Typ, Ziel-Stand (Spec 6.1). In 0.4.0 hat
// jeder laufende Slot GENAU EIN Abo; alle Wege (Umhaengen, Abbau, Messwerte)
// gehen trotzdem ueber Slot::abos, damit die Galerie (0.5.0) Abos hinzufuegen
// kann, ohne diese Wege umzubauen (Spec 15).
struct Abo {
  IZoomSDKRenderer* renderer = nullptr;
  // Der Delegate des laufenden Renderers (Abschluss-Fix F1): er gehoert g_delegates und lebt bis zum Prozessende, das Abo
  // zeigt nur auf ihn. Jeder neue Renderer bekommt einen neuen (slotOn, nach rendererTot, beim Typwechsel); der alte wird
  // vorher abgemeldet. (Bis F1: unique_ptr hier und alteDelegates nur fuer verworfene Renderer, frei mit dem Abo.)
  Delegate* delegate = nullptr;
  std::atomic<unsigned int> target{0};     // Teilnehmer-Kennung (VIDEO) oder shareSourceID (SHARE); 0 = keins
  ZoomSDKRawDataType type = RAW_DATA_TYPE_VIDEO;   // Typ des letzten subscribe() dieses Renderers
  std::atomic<bool> subscribed{false};    // true nur zwischen gegluecktem subscribe() und dem naechsten unSubscribe()
  std::atomic<bool> umhaengen{false};     // Riegel: true von vor unSubscribe() bis nach subscribe() (6.10)
  std::atomic<bool> rendererTot{false};   // onRendererBeDestroyed kam: Zeiger nie mehr anfassen (6.10, B32)
  // Umhaeng-Generation (Nachtrag N2a.1): nur ZielStandNeu zaehlt sie hoch, unter fieldMutex. Der Bild- und der
  // Status-Rueckruf lesen sie VOR dem Riegel und vergleichen sie unter fieldMutex erneut: wer den Riegel vor einem
  // Umhaengen passierte, fasst den neuen Ziel-Stand nicht an (I3 aus Stage 4, B53).
  std::atomic<uint64_t> umhaengGeneration{0};
  ZielStand ziel;                         // unter fieldMutex des Slots
  // Wiederholung nach SDKERR_TOO_FREQUENT_CALL / SDKERR_NO_SHARE_DATA (6.10), nur Hauptthread.
  bool wiederholen = false;
  int versuch = 0;
  int64_t wiederholenAbMs = 0;
  // Was die Wiederholung abonniert (Nachtrag N2a.2): Ziel, Modus und Grund DES Umhaengens, das 18 bzw. 29 bekam -
  // nach 18 lief ZielStandNeu noch nicht, abo.target ist dann das ALTE Ziel. Dazu der Modus von vorher, weil
  // slotRetargetIntern s.mode schon umgestellt hat und der Ton-Teil des Abschlusses ihn braucht (6.10 Schritt 8).
  // WIDERRUFEN durch den Abschluss-Fix F2 (R1): auch nach 18 laeuft der Abschluss sofort, abo.target ist dann schon das
  // neue Ziel. Gemerkt wird trotzdem: die Wiederholung abonniert das Ziel IHRES Umhaengens.
  unsigned wiederholZiel = 0;
  SlotMode wiederholModus = SlotMode::Participant;
  SlotMode wiederholModusVorher = SlotMode::Participant;
  Grund wiederholGrund = Grund::command;
  // Ob die Wiederholung den Ton meldet (Fixrunde 1, F4): wie das Umhaengen, das 18 bekam - beim ersten Umhaengen von
  // slotOn nicht, slotOn meldet den Ton selbst (sonst ein zweites waiting/targetChanged).
  bool wiederholTonMitmelden = true;
  // Der Abschluss (Schritte 6-8) lief beim ersten 29 schon (nur SHARE, N1.2): Erfolg oder 29 danach ohne zweiten.
  // Gesetzt nur auf diesem Weg (ein VIDEO-Abschluss enthaelt IsVideoOnFragen), geloescht beim naechsten Umhaengen.
  // Seit dem Abschluss-Fix F2 auch beim ersten 18 (VIDEO und SHARE): jeder Plan mit Abschluss vor WiederholenIn500ms.
  bool abschlussGelaufen = false;
};

struct Slot {
  int nr = 0;                              // 1..16, Schluessel in g_slots
  std::string ndi;                         // fester NDI-Name ab slotOn (E3)
  std::atomic<SlotMode> mode{SlotMode::Participant};
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  std::atomic<unsigned int> shareUser{0};  // wer die gezeigte Freigabe teilt (Computerton)
  std::atomic<SlotAudio> audio{SlotAudio::Off};
  std::atomic<bool> shareAudio{false};
  std::atomic<Fallback> fallback{Fallback::Transparent};
  std::atomic<bool> showNoVideo{true};
  std::atomic<bool> imAbbau{false};
  std::vector<std::unique_ptr<Abo>> abos;  // 0.4.0: genau ein Eintrag, solange der Slot laeuft
  NdiSender sender;

  // Sperre NUR fuer die Feldbuchfuehrung (Regel wie bisher Sub::fieldMutex): nie
  // ueber einem Sendeaufruf, kein emit*() im Sperrblock. Eigene Sperre JE SLOT.
  std::mutex fieldMutex;
  // Ausgabe-Sperre des slot-Ereignisses (Abschluss-Fix F12, Abschlusspruefung M6): emitSlot und emitSlotOff lesen den
  // Stand und schreiben die Zeile in EINEM Zug, sonst koennte ein Ereignis aus dem SDK-Thread ein neueres ueberholen.
  // Reihenfolge: emitMutex VOR fieldMutex, nie umgekehrt (emitSlot wird nie unter fieldMutex gerufen); darunter kein
  // SDK- und kein NDI-Aufruf, nur die Feldsperre und die stdout-Zeile.
  std::mutex emitMutex;
  // --- unter fieldMutex ---
  TonStand ton;
  SlotState state = SlotState::Starting;
  Grund grund = Grund::command;
  Sent sent = Sent::None;
  unsigned int rotation = 0;
  bool limitedRange = true;
  bool bufferMismatch = false;
  int64_t gapMs = -1;                      // letzte Luecke Umhaengen -> erstes passendes Bild; -1 = keine
  bool gapUngeprueft = false;
  bool gapOffen = false;                   // Luecke laeuft noch (ab Schritt 6 bis zum ersten passenden Bild bzw. 2 s)
  int64_t gapErstesBildMs = 0;             // erstes Bild nach Schritt 6 (Ende der Luecke ohne passendes Bild, 6.10)
  // --- Zaehler (atomar, beide Threads) ---
  std::atomic<uint64_t> frameCount{0}, fallbackCount{0}, heldFrames{0}, foreignFrames{0}, lateFrames{0};
  std::atomic<uint64_t> tooFrequent{0}, noShareData{0}, rendererNew{0}, rendererLost{0};
  std::atomic<uint64_t> workUs{0}, copyUs{0};
  std::atomic<uint64_t> audioPakete{0};    // gesendete bzw. gemischte Ton-Pakete (audioPps)
  // Kopie des letzten Bildes DIESES Ziels (Freeze, Freigabe; 6.12). Gueltig nur mit
  // abo.ziel.kopieGueltig.
  FrameCopy last;
  // Mischer (6.13): nur Mischer-Slots (Tonweg mixShare); beginnt neu, sobald der Slot
  // Mischer-Slot wird (Schritt MischerNeu). Nur Hauptthread.
  AudioMix mix;

  // --- nur Hauptthread ---
  int64_t letztesErsatzMs = 0;
  bool kameraAus = false;                  // Zoom meldet die Kamera des Ziels als aus (videoStatus, IsVideoOn)
  int64_t kameraGefragtBildMs = -1;        // #285/#286: lastFrameMs der Bildluecke, in der IsVideoOn() schon gefragt wurde
  int resSet = -1, resGot = -1;            // 6.11; -1 = noch nicht gesetzt
  int rawType = -1;                        // getRawDataType() nach dem Setzen der Aufloesung; -1 = keins
  int shareRate = 0, shareCh = 0;          // Format des Computertons (shareAudioRate/-Ch)
  // Messfenster fuer slotStats (6.17): Beginn und Zaehlerstaende am Fensteranfang.
  int64_t statsBeginnMs = 0;
  uint64_t statsFrames = 0, statsFallback = 0, statsWork = 0, statsCopy = 0, statsAudio = 0;
  // Bilder und Ton-Pakete zaehlen je ZIEL (B55, Nachbesserung a3): ZielStandNeu setzt statsFrames
  // und statsAudio auf den Stand des Umhaengens; fps und audioPps rechnen ab hier.
  int64_t statsZielBeginnMs = 0;
  TonZustand tonZustand = TonZustand::Off;
  TonGrund tonGrund = TonGrund::command;
  TonQuelle tonConfigured = TonQuelle::None;
  TonQuelle tonSource = TonQuelle::None;   // gemessen, letztes 500-ms-Fenster (6.3)
  bool tonAudioUnavailable = false;        // audioEnsureSubscribed() scheiterte; bleibt bis Ton neu an (6.13)
  int64_t tonFensterBeginnMs = 0;
  bool tonFensterPerson = false;
  bool tonFensterMix = false;              // Mischton ging direkt hinaus
  bool tonFensterShare = false;            // Computerton ging direkt hinaus
  bool tonFensterMischA = false;           // Mischer bekam Mischton (Eingang A)
  bool tonFensterMischB = false;           // Mischer bekam Computerton (Eingang B)
  bool rateMismatchGemeldet = false;       // slotAudio rateMismatch (T76) ist gemeldet
  int64_t versatzMessBeginnMs = 0;
  // Vorgemerktes Umhaengen waehrend der Renderer-Sperre (6.10 Schritt 0).
  bool vorgemerkt = false;
  SlotMode vorgemerktMode = SlotMode::Participant;
  unsigned vorgemerktZiel = 0;
  Grund vorgemerktGrund = Grund::command;
  // Ein slotSet laeuft gerade (Abschluss-Fix F7): merkt die Sperre sein Umhaengen nur vor, bestaetigt slotRetargetIntern
  // den Befehl mit einem slot-Ereignis (6.2). Gesetzt und geloescht nur in slotSet.
  bool slotSetLaeuft = false;
  // Sprecher-Slot: die Wahl dieses Slots (6.8), neu bei Einschalten, Moduswechsel auf
  // Sprecher und Wechsel des Signals, je aus der Erinnerung vorbelegt.
  std::unique_ptr<SprecherWahl> wahl;

  Abo& abo() { return *abos.front(); }

  // Bildweg Delegate -> Slot -> Kopie, Vorschau, Sender (6.1, 0.30). Nie direkt
  // Delegate -> Sender: 0.5.0 setzt hier einen Zusammensetzer ein.
  void bildAnkunft(Abo& abo, YUVRawDataI420* data);
};

std::map<int, std::unique_ptr<Slot>> g_slots;   // hoechstens 16 Eintraege

// Alle Delegates leben bis zum Prozessende (Abschluss-Fix F1, Abschlusspruefung I-1): ob und wann das SDK einen Delegate
// nach destroyRenderer, nach dem Meeting-Ende oder nach dem Verwerfen seines Renderers noch ruft (onRendererBeDestroyed,
// rawdata_renderer_interface.h:36-40), sagt kein Header. Darum gibt die Bridge keinen frei - new ohne delete, die Liste
// waechst nur (je Renderer ein Delegate, ein paar Byte). Nur Hauptthread. Wer einen Renderer verwirft oder abbaut oder
// seinen Slot loescht, meldet den Delegate vorher ab (delegateAbmelden); danach fasst er weder Slot noch Abo an.
std::vector<Delegate*> g_delegates;

Delegate* neuerDelegate(Slot& s, Abo& abo) {
  g_delegates.push_back(new Delegate(&s, &abo, s.nr));
  return g_delegates.back();
}

void delegateAbmelden(Abo& abo) {
  if (abo.delegate != nullptr) rueckrufAbmelden(abo.delegate->wache);
}

// Sprecher und Freigaben (6.8, 6.9): EINE Erinnerung und EINE Liste je Bridge, nur
// Hauptthread. Gefuettert aus den Merkern (main.cpp, merkerNehmen).
SprecherErinnerung g_erinnerung;
SprecherEinstellung g_sprecher;                 // speakerConfig; Vorgabe speakerVideo, 1000 ms (E19)
FreigabeListe g_freigaben;
// Der erste Freigabe-Slot nach dem Leeren der Liste hat ergaenzend befuellt (Abschluss-Fix F8 e, wie die Attrappe:
// einmal je Meeting, 6.9 „erstes Einschalten eines Freigabe-Slots“). Geloescht im Schritt FreigabenLeeren.
bool g_freigabenErgaenzt = false;
struct FreigabeRueckruf { int64_t ms; bool inhalt; int status; unsigned user, share; int typ; };
std::deque<FreigabeRueckruf> g_freigabeRecent;  // die letzten 10 Freigabe-Rueckrufe, roh (6.3)
unsigned g_gezeigtShare = 0, g_gezeigtUser = 0; // zuletzt gezeigte Freigabe (slotLogicTick)

// --- Ausgabe -------------------------------------------------------------------------

template <size_t N, class E>
const char* nameVon(const char* const (&tabelle)[N], E wert) {
  const size_t i = static_cast<size_t>(wert);
  return i < N ? tabelle[i] : "unknown";
}

int64_t jetztMs() { return static_cast<int64_t>(GetTickCount64()); }

long long qpcFrequenz() {
  static const long long f = [] {
    LARGE_INTEGER q;
    QueryPerformanceFrequency(&q);
    return q.QuadPart;
  }();
  return f;
}

long long qpcJetzt() {
  LARGE_INTEGER q;
  QueryPerformanceCounter(&q);
  return q.QuadPart;
}

uint64_t qpcUs(long long von, long long bis) {
  const long long f = qpcFrequenz();
  return (f > 0 && bis > von) ? static_cast<uint64_t>((bis - von) * 1000000LL / f) : 0;
}

// target/share eines Slots (Spec 6.3): target = Teilnehmer-Kennung bzw. bei SHARE die teilende Person, share =
// Freigabe-Kennung (nur SHARE). Eine Stelle fuer jedes slot-Ereignis, auch slot off (Abschluss-Fix F8 a).
void zielPaar(Slot& s, SlotMode mode, unsigned* target, unsigned* share) {
  *target = 0;
  *share = 0;
  if (s.abos.empty()) return;
  const unsigned t = s.abo().target.load();
  if (mode == SlotMode::Share) { *share = t; *target = t != 0 ? s.shareUser.load() : 0; }
  else *target = t;
}

// slot-Ereignis (Spec 6.3). target = Teilnehmer-Kennung bzw. bei SHARE die teilende
// Person, share = Freigabe-Kennung (nur SHARE). rotation/limitedRange erst nach dem
// ersten Bild DIESES Ziels (Regel "keine erfundenen Werte", B55).
void emitSlot(Slot& s) {
  // F12: Stand lesen und Zeile schreiben in einem Zug, vor fieldMutex (Reihenfolge am Feld emitMutex).
  std::lock_guard<std::mutex> ausgabe(s.emitMutex);
  // Nach slot off (imAbbau, emitSlotOff haelt dieselbe Sperre) kommt kein spaetes slot-Ereignis mehr, etwa aus einem
  // Bild-Rueckruf, der den Riegel vor dem Abbau passierte.
  if (s.imAbbau.load()) return;
  SlotState state;
  Grund grund;
  Sent sent;
  unsigned rotation = 0;
  bool limited = true, gemessen = false;
  unsigned target = 0, share = 0;
  const SlotMode mode = s.mode.load();
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    state = s.state;
    grund = s.grund;
    sent = s.sent;
    rotation = s.rotation;
    limited = s.limitedRange;
    if (!s.abos.empty()) gemessen = s.abo().ziel.gemessen;
  }
  zielPaar(s, mode, &target, &share);
  std::string out = "{\"ev\":\"slot\",\"slot\":" + std::to_string(s.nr) + ",\"state\":\"" + nameVon(ZUSTAND_NAMEN, state) +
                    "\",\"mode\":\"" + nameVon(MODUS_NAMEN, mode) + "\",\"target\":" + std::to_string(target) +
                    ",\"share\":" + std::to_string(share) + ",\"reason\":\"" + nameVon(GRUND_NAMEN, grund) +
                    "\",\"sent\":\"" + nameVon(SENT_NAMEN, sent) + "\",\"ndi\":\"" + jsonEscapeUtf8(s.ndi) + "\"";
  if (gemessen) {
    out += ",\"rotation\":" + std::to_string(rotation) + ",\"limitedRange\":" + (limited ? "true" : "false");
  }
  out += "}";
  emitRaw(out);
}

// slot off (Abbau): der Slot existiert danach nicht mehr, darum ohne Messfelder. Mit dem letzten Paar target/share
// (Abschluss-Fix F8 a: die Spec schweigt, die Attrappe meldet es so; bis dahin 0/0).
void emitSlotOff(Slot& s, Grund grund) {
  std::lock_guard<std::mutex> ausgabe(s.emitMutex);   // F12: dieselbe Ausgabe-Sperre wie emitSlot
  const SlotMode mode = s.mode.load();
  unsigned target = 0, share = 0;
  zielPaar(s, mode, &target, &share);
  emitRaw("{\"ev\":\"slot\",\"slot\":" + std::to_string(s.nr) + ",\"state\":\"off\",\"mode\":\"" + nameVon(MODUS_NAMEN, mode) +
          "\",\"target\":" + std::to_string(target) + ",\"share\":" + std::to_string(share) + ",\"reason\":\"" +
          nameVon(GRUND_NAMEN, grund) + "\",\"sent\":\"none\",\"ndi\":\"" + jsonEscapeUtf8(s.ndi) + "\"}");
}

// Bestaetigung eines slotSet ohne ausgefuehrtes Umhaengen (6.2): der aktuelle Stand mit Grund command - auch, wenn die
// Renderer-Sperre das Umhaengen nur vormerkt (Abschluss-Fix F7).
void slotBestaetigen(Slot& s) {
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    s.grund = Grund::command;
  }
  emitSlot(s);
}

// slotAudio-Ereignis (Spec 6.3): sampleRate/channels nur nach dem ersten Paket.
void emitSlotAudio(Slot& s) {
  int rate = 0, ch = 0;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    rate = s.ton.audioRate;
    ch = s.ton.audioChannels;
  }
  std::string out = "{\"ev\":\"slotAudio\",\"slot\":" + std::to_string(s.nr) + ",\"state\":\"" +
                    nameVon(TONZUSTAND_NAMEN, s.tonZustand) + "\",\"source\":\"" + nameVon(TONQUELLE_NAMEN, s.tonSource) +
                    "\",\"configured\":\"" + nameVon(TONQUELLE_NAMEN, s.tonConfigured) + "\",\"reason\":\"" +
                    nameVon(TONGRUND_NAMEN, s.tonGrund) + "\"";
  if (rate > 0) out += ",\"sampleRate\":" + std::to_string(rate) + ",\"channels\":" + std::to_string(ch);
  out += "}";
  emitRaw(out);
}

void tonMelden(Slot& s, TonZustand z, TonGrund g) {
  s.tonZustand = z;
  s.tonGrund = g;
  emitSlotAudio(s);
}

// Ein SDKError, der nicht auf die Rohrleitung gehoert (Abbau, Umhaengen): stderr.
void logSdkError(const wchar_t* was, SDKError err) {
  if (err == SDKERR_SUCCESS) return;
  emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei ") + was + L": SDKError=" +
          std::to_wstring(static_cast<int>(err)));
}

// Nenngroesse fuer Ersatzbilder vor dem ersten Bild (6.11, wie bisher).
int nominalWidth(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_360P:  return 640;
    case ZoomSDKResolution_1080P: return 1920;
    default:                      return 1280;
  }
}

int nominalHeight(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_360P:  return 360;
    case ZoomSDKResolution_1080P: return 1080;
    default:                      return 720;
  }
}

ZoomSDKRawDataType rohTyp(SlotMode m) { return m == SlotMode::Share ? RAW_DATA_TYPE_SHARE : RAW_DATA_TYPE_VIDEO; }
RendererTyp rendererTyp(ZoomSDKRawDataType t) { return t == RAW_DATA_TYPE_SHARE ? RendererTyp::Share : RendererTyp::Video; }

// IsVideoOn() des Ziels (meeting_participants_ctrl_interface.h:127). true, wenn
// unbekannt: "Kamera aus" ist eine Aussage, die nur Zoom machen darf (6.7).
// Waehrend der Renderer-Sperre fragt die Bridge nicht (Abschluss-Fix F13, M7): Zoom trennt oder verbindet neu, die
// Antwort gilt als unbekannt.
bool kameraAn(unsigned id) {
  if (rendererSperre()) return true;
  IMeetingParticipantsController* ctrl = participantsCtrl();
  IUserInfo* u = (ctrl != nullptr && id != 0) ? ctrl->GetUserByUserID(id) : nullptr;
  return u == nullptr ? true : u->IsVideoOn();
}

// --- Umhaengen (Spec 6.10) -----------------------------------------------------------
// EINZIGER Ort, an dem ein Renderer abonniert, abgemeldet oder umgehaengt wird. Die
// Schrittfolge kommt aus umhaengPlan()/umhaengNachSubscribe() (slot_logic.h); hier
// werden die Schritte nur ausgefuehrt.

struct UmhaengLauf {
  UmhaengLage lage;
  unsigned ziel = 0;
  bool tonMitmelden = true;    // slotOn meldet den Ton selbst (tonUmschaltPlan)
  bool subscribeGeglueckt = false;
  int sdkFehler = 0;           // letzte Rueckgabe von subscribe bzw. createRenderer (slotSubscribeFailed.sdk, 3.3)
};

void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan);

// EINZIGE Stelle mit createRenderer: slotOn ("Renderer anlegen", 6.2) und der
// Umhaeng-Ausfuehrer (neuer Delegate nach rendererTot, gleicher Delegate beim
// Typwechsel, 6.10) rufen sie. Seit dem Abschluss-Fix F1 auch beim Typwechsel ein neuer Delegate (abo.delegate setzt
// der Aufrufer vorher mit neuerDelegate). Liefert den SDKError; ohne Renderer nie SUCCESS. Zwei Slots auf dieselbe Kennung haben je einen eigenen Renderer, beide beliefert: ANNAHME AN21 (unbelegt, MS21).
SDKError rendererAnlegen(Abo& abo) {
  if (rendererSperre()) return SDKERR_WRONG_USAGE;   // 6.5: kein Renderer-Aufruf waehrend der Sperre
  abo.renderer = nullptr;
  SDKError err = createRenderer(&abo.renderer, abo.delegate);
  if (err == SDKERR_SUCCESS && abo.renderer == nullptr) err = SDKERR_UNINITIALIZE;
  if (err != SDKERR_SUCCESS) {
    abo.renderer = nullptr;
    return err;
  }
  abo.rendererTot = false;
  return SDKERR_SUCCESS;
}

void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf) {
  if (rendererSperre()) return;   // 6.5: kein Renderer-Aufruf waehrend der Sperre
  Abo& abo = s.abo();
  const ZoomSDKRawDataType typ = rohTyp(lauf.lage.modusNachher);
  const SDKError err = abo.renderer != nullptr ? abo.renderer->subscribe(lauf.ziel, typ) : SDKERR_UNINITIALIZE;
  lauf.sdkFehler = static_cast<int>(err);
  if (err != SDKERR_SUCCESS) logSdkError(L"subscribe() beim Umhaengen", err);
  if (err == SDKERR_SUCCESS) {
    abo.type = typ;
    lauf.lage.letzterTyp = rendererTyp(typ);
    lauf.subscribeGeglueckt = true;
    abo.wiederholen = false;
    abo.versuch = 0;
  }
  if (err == SDKERR_TOO_FREQUENT_CALL) s.tooFrequent.fetch_add(1);
  if (err == SDKERR_NO_SHARE_DATA) s.noShareData.fetch_add(1);
  if (err == SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF) emitLog(L"subscribe(SHARE) meldet SHARE_CANNOT_SUBSCRIBE_MYSELF - die Bridge teilt nie selbst");
  // N2a.2: der Merker am Abo, nicht versuch (bei Erfolg oben schon 0) - lief der Abschluss beim ersten 29, kein zweiter.
  // WIDERRUFEN „nur beim ersten 29“ seit dem Abschluss-Fix F2: auch beim ersten 18 laeuft der Abschluss und setzt den
  // Merker; fuer beide Wege gilt: kein zweiter.
  lauf.lage.abschlussGelaufen = abo.abschlussGelaufen;
  const UmhaengPlan weiter = umhaengNachSubscribe(lauf.lage, static_cast<int>(err), abo.versuch);
  planAusfuehren(s, lauf, weiter);
  // Fehler nach einem Typwechsel ist ein Fall fuer einen neuen Renderer: der Plan ruft dann DestroyRenderer,
  // CreateRendererTypwechsel (seit dem Abschluss-Fix F1 mit neuem Delegate) und Subscribe erneut.
  if (err != SDKERR_SUCCESS && !abo.wiederholen) abo.type = typ;
}

void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) {
  // 6.5/6.10 Schritt 0: waehrend der Renderer-Sperre gibt umhaengPlan nur Vormerken;
  // ein Plan mit Renderer-Schritten laeuft dann nicht an. Ton- und Feld-Plaene (slotSet
  // {audio|shareAudio}: TonStandNeu, MischerNeu, TonMelden) laufen auch in der Sperre
  // (Nachtrag N2b.2, Task-14-Review I1) - sonst blieben Ton-Stand, Mischer und configured alt.
  if (rendererSperre() && planBrauchtRenderer(plan)) return;
  Abo& abo = s.abo();
  size_t tonNr = 0;   // naechste Meldung aus plan.tonFolge (E-a2-7)
  // dieser Plan lief schon durch ZielStandNeu (29-Weg: Abschluss vor WiederholenIn500ms). Seit dem Abschluss-Fix F2
  // ebenso der 18-Weg - „nur 29“ ist widerrufen.
  bool abschlussHier = false;
  for (const UmhaengSchritt schritt : plan.schritte) {
    switch (schritt) {
      case UmhaengSchritt::Vormerken:
        s.vorgemerkt = true;
        s.vorgemerktMode = lauf.lage.modusNachher;
        s.vorgemerktZiel = lauf.ziel;
        s.vorgemerktGrund = lauf.lage.aufruf;
        emitLog(L"Slot " + std::to_wstring(s.nr) + L": Umhaengen vorgemerkt (Renderer-Sperre)");
        break;
      case UmhaengSchritt::Unsubscribe:
        if (abo.renderer != nullptr && !abo.rendererTot.load()) {
          logSdkError(L"unSubscribe() beim Umhaengen", abo.renderer->unSubscribe());
        }
        abo.subscribed = false;
        break;
      case UmhaengSchritt::ZeigerVerwerfen:
        // Nie destroyRenderer, nie ein anderer Aufruf: das SDK hat ihn abgebaut (B32). Sein Delegate wird abgemeldet und
        // lebt bis zum Prozessende (Abschluss-Fix F1); der neue Renderer bekommt einen neuen.
        abo.renderer = nullptr;
        abo.subscribed = false;
        delegateAbmelden(abo);
        abo.delegate = nullptr;
        break;
      case UmhaengSchritt::CreateRendererNeuerDelegate: {
        abo.delegate = neuerDelegate(s, abo);
        const SDKError err = rendererAnlegen(abo);
        if (err != SDKERR_SUCCESS) {
          logSdkError(L"createRenderer() nach rendererTot", err);
          // E-a2-7: abbrechen; den Rest (Ziel-Stand, fallback/subscribeFailed, slotSubscribeFailed, Ton) gibt
          // umhaengNachSubscribe mit rendererGescheitert.
          lauf.lage.rendererGescheitert = true;
          lauf.sdkFehler = static_cast<int>(err);
          planAusfuehren(s, lauf, umhaengNachSubscribe(lauf.lage, lauf.sdkFehler, abo.versuch));
          return;
        }
        break;
      }
      case UmhaengSchritt::DestroyRenderer:
        // Typwechsel (Abschluss-Fix F1): den Delegate des alten Renderers ZUERST abmelden - ein spaetes
        // onRendererBeDestroyed des alten Renderers trifft dann nie das Abo des neuen (CreateRendererTypwechsel).
        delegateAbmelden(abo);
        if (abo.renderer != nullptr && !abo.rendererTot.load()) logSdkError(L"destroyRenderer() beim Typwechsel", destroyRenderer(abo.renderer));
        abo.renderer = nullptr;
        abo.delegate = nullptr;
        break;
      case UmhaengSchritt::CreateRendererTypwechsel: {
        // Typwechsel nach gescheitertem subscribe (6.10, AN11: ob destroyRenderer
        // synchron abschliesst, sagt kein Header - der gleiche Delegate bleibt).
        // BERICHTIGT (Abschluss-Fix F1, Ruling des Controllers): ein NEUER Delegate - bewusste Abweichung von Spec 6.10
        // „createRenderer mit demselben Delegate (AN11)“. AN11 erlaubt die Wiederverwendung, verlangt sie nicht; mit dem
        // alten Delegate setzte ein spaetes onRendererBeDestroyed des alten Renderers rendererTot am neuen, lebenden.
        abo.delegate = neuerDelegate(s, abo);
        const SDKError err = rendererAnlegen(abo);
        s.rendererNew.fetch_add(1);
        lauf.lage.letzterTyp = rendererTyp(rohTyp(lauf.lage.modusNachher));
        if (err != SDKERR_SUCCESS) {
          logSdkError(L"createRenderer() beim Typwechsel", err);
          lauf.lage.rendererGescheitert = true;   // E-a2-7, wie beim neuen Delegate
          lauf.sdkFehler = static_cast<int>(err);
          planAusfuehren(s, lauf, umhaengNachSubscribe(lauf.lage, lauf.sdkFehler, abo.versuch));
          return;
        }
        break;
      }
      case UmhaengSchritt::SetResolution:   // ein Wunsch, kein Versprechen; gemeldet wird resGot (ANNAHME AN1, unbelegt)
        s.resSet = abo.renderer != nullptr ? static_cast<int>(abo.renderer->setRawDataResolution(s.res)) : -1;
        break;
      case UmhaengSchritt::GetResolution:
        s.resGot = abo.renderer != nullptr ? static_cast<int>(abo.renderer->getResolution()) : -1;
        // Messwert zu MS5: welchen Rohdaten-Typ der Renderer meldet.
        s.rawType = abo.renderer != nullptr ? static_cast<int>(abo.renderer->getRawDataType()) : -1;
        break;
      case UmhaengSchritt::Subscribe:
        subscribeAusfuehren(s, lauf);
        return;   // der Rest steht im Plan nach subscribe (umhaengNachSubscribe)
      case UmhaengSchritt::WiederholenIn500ms:
        abo.wiederholen = true;
        ++abo.versuch;
        abo.wiederholenAbMs = jetztMs() + 500;
        // N2a.2: der Abschluss eines 29 (nur SHARE) laeuft genau einmal; ein VIDEO-Abschluss setzt den Merker nie.
        // Abschluss-Fix F2 (R1): seit der Abschluss auch beim ersten 18 laeuft (VIDEO und SHARE), merkt jeder Plan mit
        // Abschluss vor der Wiederholung ihn - die weiteren Versuche und der Erfolg laufen ohne zweiten.
        if (abschlussHier) abo.abschlussGelaufen = true;
        // N2a.2: die Wiederholung gilt DIESEM Umhaengen. Lief sein Abschluss schon, zaehlt der Moduswechsel als
        // erledigt (Ton und Versatz sind umgestellt); sonst bleibt der Modus von vorher fuer den Abschluss.
        abo.wiederholZiel = lauf.ziel;
        abo.wiederholModus = lauf.lage.modusNachher;
        abo.wiederholModusVorher = abo.abschlussGelaufen ? lauf.lage.modusNachher : lauf.lage.modusVorher;
        abo.wiederholGrund = lauf.lage.aufruf;
        abo.wiederholTonMitmelden = lauf.tonMitmelden;   // F4
        break;
      case UmhaengSchritt::ZielStandNeu: {
        std::lock_guard<std::mutex> lock(s.fieldMutex);
        abo.ziel = ZielStand{};
        abo.ziel.retargetMs = jetztMs();
        s.bufferMismatch = false;
        s.heldFrames = 0;   // gehaltene Bilder zaehlen je Ziel (6.17)
        // Messfenster je ZIEL (B55, Nachbesserung a3): Bilder und Ton-Pakete des alten Ziels
        // zaehlen nicht fuer das neue; w/h/fps fehlen, bis ein Bild des neuen Ziels kam.
        s.statsZielBeginnMs = abo.ziel.retargetMs;
        s.statsFrames = s.frameCount.load();
        s.statsAudio = s.audioPakete.load();
        s.gapUngeprueft = false;
        abo.target = lauf.ziel;
        abo.umhaengGeneration.fetch_add(1);   // nach dem Ziel: wer die neue Generation liest, liest auch das neue Ziel
        s.kameraAus = false;
        s.gapOffen = true;           // die Luecke beginnt neu (6.10, Nachbesserung a3)
        s.gapErstesBildMs = 0;
        abschlussHier = true;
        break;
      }
      case UmhaengSchritt::VorschauPlatzLeeren:
        // Die Vorschau zeigt nie ein Bild des alten Ziels (6.10 Schritt 6, 7.7).
        vorschauLeeren(s.nr);
        break;
      case UmhaengSchritt::IsVideoOnFragen:
        if (lauf.ziel != 0 && !kameraAn(lauf.ziel)) s.kameraAus = true;
        break;
      case UmhaengSchritt::SlotMelden: {
        SlotState z = plan.zustand;
        Grund g = plan.grund;
        if (s.kameraAus && z == SlotState::Starting) {
          // 6.10 Schritt 7: eine Rueckkehr mit ausgeschalteter Kamera zeigt gleich T19.
          z = SlotState::Fallback;
          g = lauf.lage.modusNachher == SlotMode::Speaker ? Grund::speakerNoVideo : Grund::cameraOff;
        }
        {
          std::lock_guard<std::mutex> lock(s.fieldMutex);
          s.state = z;
          s.grund = g;
        }
        emitSlot(s);
        break;
      }
      case UmhaengSchritt::FehlerSubscribeMelden:
        emitRaw("{\"ev\":\"error\",\"where\":\"slot\",\"code\":\"slotSubscribeFailed\",\"slot\":" + std::to_string(s.nr) +
                ",\"sdk\":" + std::to_string(lauf.sdkFehler) + ",\"type\":\"" +
                (lauf.lage.modusNachher == SlotMode::Share ? "share" : "video") + "\"}");
        break;
      case UmhaengSchritt::TonStandNeu: {
        {
          std::lock_guard<std::mutex> lock(s.fieldMutex);
          s.ton = TonStand{};
        }
        // Nachtrag N2b.6 (6.17 „fehlt ein Wert, ist nichts angekommen“, B55): das Format des Computertons gehoert zum
        // Ton-Stand - nach Computerton aus, Freigabe- oder Moduswechsel fehlt es, bis wieder Computerton ankommt.
        s.shareRate = 0;
        s.shareCh = 0;
        break;
      }
      case UmhaengSchritt::MischerEingangBNeu: {
        // Freigabewechsel im Mischer-Slot: nur der Computerton beginnt neu (6.10 Schritt 8) - samt seinem Format
        // (N2b.6; dieser Weg plant kein TonStandNeu, der Mischton laeuft weiter, RR8).
        s.mix.eingangBNeu();
        s.shareRate = 0;
        s.shareCh = 0;
        // Fixrunde 1, G4: der Mischer schreibt jetzt im Format von A - slotAudio nennt es sofort (wie N2b.3 beim
        // Einspeisen), nicht erst mit dem naechsten Paket. Nur Feldbuchfuehrung unter der Sperre.
        std::lock_guard<std::mutex> lock(s.fieldMutex);
        s.ton.audioRate = s.mix.rate();
        s.ton.audioChannels = s.mix.kanaele();
        break;
      }
      case UmhaengSchritt::MischerNeu:
        // Der Slot wird Mischer-Slot: Uhr, Eingaenge und Vorlauf von vorn (Restnachfix N1).
        s.mix = AudioMix{};
        s.rateMismatchGemeldet = false;
        break;
      case UmhaengSchritt::TonMelden: {
        // E-a2-7: je Schritt TonMelden die naechste Meldung aus tonFolge, in Reihenfolge.
        if (tonNr >= plan.tonFolge.size()) break;
        const TonMeldung& m = plan.tonFolge[tonNr++];
        s.tonConfigured = m.configured;
        if (lauf.tonMitmelden && !s.tonAudioUnavailable) tonMelden(s, m.zustand, m.grund);
        break;
      }
      case UmhaengSchritt::VersatzLeeren:
        // Moduswechsel von oder zur Freigabe (6.14): wartende Bilder verwerfen.
        s.sender.leereVersatz();
        break;
      case UmhaengSchritt::OhneVersatzSetzen:
        // Freigabe-Slots senden ohne den Bild-Versatz der Personen (6.14, E11).
        s.sender.setOhneVersatz(lauf.lage.modusNachher == SlotMode::Share);
        break;
    }
  }
}

UmhaengLage lageFuer(Slot& s, SlotMode nachher, unsigned ziel, Grund aufruf) {
  Abo& abo = s.abo();
  UmhaengLage l{};
  l.sperre = rendererSperre();
  l.abonniert = abo.subscribed.load();
  l.rendererTot = abo.rendererTot.load();
  l.modusVorher = s.mode.load();
  l.modusNachher = nachher;
  l.neuesZiel = ziel;
  l.altesZiel = abo.target.load();   // E-a2-7: ohne Zielwechsel (neue Aufloesung) bleibt der Ton
  l.aufruf = aufruf;
  l.letzterTyp = rendererTyp(abo.type);
  l.audio = s.audio.load();
  l.shareAudio = s.shareAudio.load();
  l.tonAudioUnavailable = s.tonAudioUnavailable;
  l.freigabeNochGezeigt = nachher == SlotMode::Share && ziel != 0;
  return l;
}

void slotRetargetIntern(Slot& s, SlotMode nachher, unsigned ziel, Grund aufruf, bool tonMitmelden) {
  Abo& abo = s.abo();
  UmhaengLauf lauf;
  lauf.lage = lageFuer(s, nachher, ziel, aufruf);
  lauf.ziel = ziel;
  lauf.tonMitmelden = tonMitmelden;
  const UmhaengPlan plan = umhaengPlan(lauf.lage);
  const bool nurVormerken = plan.schritte.size() == 1 && plan.schritte.front() == UmhaengSchritt::Vormerken;
  if (!nurVormerken) {
    // Riegel ZUERST (6.10 Schritt 1): ab hier verwirft der Rueckruf Bild und Status.
    abo.umhaengen = true;
    s.vorgemerkt = false;
    abo.wiederholen = false;
    abo.versuch = 0;
    abo.abschlussGelaufen = false;   // N2a.2: ein neues Umhaengen hat seinen eigenen Abschluss
    s.mode = nachher;
  }
  planAusfuehren(s, lauf, plan);
  if (nurVormerken) {
    // Abschluss-Fix F7 (M1 d; 6.2 slotSet „Bestaetigung immer mit einem slot-Ereignis“): kam das Umhaengen aus einem
    // slotSet, bestaetigt ein slot-Ereignis mit dem aktuellen Stand (Grund command) - Sprecher, Freigabe und Weggang
    // melden waehrend der Sperre weiter nichts.
    if (s.slotSetLaeuft) slotBestaetigen(s);
    return;
  }
  abo.subscribed = lauf.subscribeGeglueckt;
  abo.umhaengen = false;
}

void slotRetarget(Slot& s, SlotMode nachher, unsigned ziel, Grund aufruf) {
  slotRetargetIntern(s, nachher, ziel, aufruf, true);
}

// --- Sprecher und Freigaben (Spec 6.8, 6.9) ------------------------------------------

KameraAn kameraAbfrage() {
  return [](unsigned id) { return kameraAn(id); };
}

std::unique_ptr<SprecherWahl> neueWahl(const Slot& s) {
  SprecherEinstellung e = g_sprecher;
  e.showNoVideo = s.showNoVideo.load();
  return std::make_unique<SprecherWahl>(e, sessionMyUserId());
}

// shares-Ereignis (6.3): Liste, gezeigte Freigabe, die letzten 10 Rueckrufe roh; seeded
// nur unmittelbar nach einem Befuellen. Ohne Namen.
void emitShares(const char* seeded) {
  const FreigabeEintrag* g = g_freigaben.gezeigt();
  std::string out = "{\"ev\":\"shares\",\"list\":[";
  bool erst = true;
  for (const FreigabeEintrag& e : g_freigaben.eintraege()) {
    if (!erst) out += ",";
    erst = false;
    out += "{\"user\":" + std::to_string(e.user) + ",\"share\":" + std::to_string(e.share) + ",\"status\":\"" +
           (e.paused ? "paused" : "running") + "\",\"type\":\"" + nameVon(SHARE_TYP_NAMEN, e.type) + "\",\"audioOnly\":" +
           (e.audioOnly ? "true" : "false") + ",\"pauses\":" + std::to_string(e.pauses) + "}";
  }
  out += "],\"shown\":" + std::to_string(g != nullptr ? g->share : 0);
  if (seeded != nullptr) out += std::string(",\"seeded\":\"") + seeded + "\"";
  out += ",\"recent\":[";
  erst = true;
  for (const FreigabeRueckruf& r : g_freigabeRecent) {
    // Abschluss-Fix F3 (M3): ein Status ausserhalb des Headers wird nicht gemeldet (sharingStatusName, slot_logic.h) -
    // kein „unknown“, das SharingStatusName nicht kennt.
    const char* statusName = sharingStatusName(r.status);
    if (statusName == nullptr) continue;
    if (!erst) out += ",";
    erst = false;
    out += "{\"ms\":" + std::to_string(r.ms) + ",\"cb\":\"" + (r.inhalt ? "shareContent" : "sharingStatus") + "\",\"status\":\"" +
           statusName + "\",\"user\":" + std::to_string(r.user) + ",\"share\":" + std::to_string(r.share) +
           ",\"type\":\"" + nameVon(SHARE_TYP_NAMEN, r.typ) + "\"}";
  }
  out += "]}";
  emitRaw(out);
}

// Index = Wert der Aufzaehlung im Header (A-EP4); haelt die Tabellen in slot_logic.h ehrlich.
static_assert(Sharing_Other_Share_Begin == 4 && Sharing_Pause == 9 && Sharing_Resume == 10, "SharingStatus wie SHARING_STATUS_NAMES");
static_assert(SHARE_TYPE_DS == 2 && SHARE_TYPE_COMPUTER_AUDIO == 10, "ShareType wie SHARE_TYPE_NAMES");

// Befuellen (6.9): GetViewableSharingUserList, je Person GetSharingSourceInfoList. Im
// Custom-UI-Modus kann die zweite Liste leer bleiben (ANNAHME AN14, MS3). nurErgaenzen:
// beim ersten Freigabe-Slot; sonst (INMEETING) nach dem Leeren.
void freigabenBefuellen(bool nurErgaenzen) {
  IMeetingShareController* ctrl = shareCtrl();
  IList<unsigned int>* nutzer = ctrl != nullptr ? ctrl->GetViewableSharingUserList() : nullptr;
  Befuellt b;
  if (nutzer == nullptr) {
    b = g_freigaben.befuellen(nullptr, nurErgaenzen);
  } else {
    std::vector<FreigabeEintrag> liste;
    for (int i = 0; i < nutzer->GetCount(); ++i) {
      const unsigned user = nutzer->GetItem(i);
      IList<ZoomSDKSharingSourceInfo>* quellen = ctrl->GetSharingSourceInfoList(user);
      for (int k = 0; quellen != nullptr && k < quellen->GetCount(); ++k) {
        const ZoomSDKSharingSourceInfo info = quellen->GetItem(k);
        FreigabeEintrag e;
        e.share = info.shareSourceID;
        e.user = info.userid != 0 ? info.userid : user;
        e.paused = info.status == Sharing_Pause;
        e.type = static_cast<uint8_t>(info.contentType);
        e.audioOnly = info.contentType == SHARE_TYPE_COMPUTER_AUDIO || info.status == Sharing_Other_Share_Pure_Audio_Begin;
        liste.push_back(e);
      }
    }
    b = g_freigaben.befuellen(&liste, nurErgaenzen);
  }
  emitShares(b == Befuellt::Ok ? "ok" : b == Befuellt::Leer ? "empty" : "unavailable");
}

// Gewuenschtes Ziel (Nachtrag N2a Fixrunde 1, F1): waehrend einer anstehenden Wiederholung (18/29) deren Ziel - nach
// 18 ist abo.target noch das alte -, sonst abo.target. Fuer alles, was mit einem Befehl, einem Weggang oder der
// Sprecher-Wahl vergleicht. Der GEZEIGTE Ziel-Stand (Herzschlag, Kopie, Ton-Zuordnung, Messwerte, slot-Ereignis)
// bleibt an abo.target. Nur Hauptthread (wiederholen/wiederholZiel).
// Seit dem Abschluss-Fix F2 (R1) laeuft der Abschluss auch nach 18 sofort; dann ist abo.target schon das gewuenschte
// Ziel, und kein Bild, kein Ton und kein slot-Ereignis des alten Ziels bleibt in der Wartezeit stehen.
unsigned zielImLauf(const Abo& a) { return gewuenschtesZiel(a.wiederholen, a.wiederholZiel, a.target.load()); }

// Kennung aus einem Befehl als Ziel (6.7): gehoert sie keinem Teilnehmer, gilt sie als Ziel 0
// (noTarget) mit stderr-Zeile - kein Fehler, Connect kann in einem Zwischenstand eine veraltete
// Kennung schicken. EINZIGE Pruefstelle fuer slotOn, Moduswechsel und id-Zweig (Nachtrag N2a.4).
unsigned teilnehmerZiel(int nr, unsigned id) {
  if (id == 0 || sessionFindParticipant(id, nullptr, nullptr)) return id;
  emitLog(L"Slot " + std::to_wstring(nr) + L": Kennung " + std::to_wstring(id) + L" gehoert keinem Teilnehmer - kein Ziel");
  return 0;
}

// Ziel nach Modus (6.7-6.10): Teilnehmer die Kennung (geprueft, teilnehmerZiel), Sprecher der
// Kandidat aus der Erinnerung (neue SprecherWahl, vorbelegt), Freigabe die gezeigte Freigabe
// (shareUser = teilende Person). Der erste Freigabe-Slot befuellt die Liste, nur ergaenzend (B38).
// Abschluss-Fix F8 e (M1 e; 6.9 „erstes Einschalten eines Freigabe-Slots“, die Spec sagt nicht, ob je Meeting oder je
// Augenblick): wie die Attrappe einmal nach jedem Leeren der Liste (INMEETING, leave, Meeting-Ende, quit) - bis dahin
// bei jedem ersten Freigabe-Slot des Augenblicks (andererFreigabeSlot), mit seeded jedes Mal.
unsigned zielNachModus(Slot& s, SlotMode m, unsigned idTeilnehmer, int64_t jetzt) {
  if (m == SlotMode::Participant) return teilnehmerZiel(s.nr, idTeilnehmer);
  if (m == SlotMode::Speaker) {
    s.wahl = neueWahl(s);
    s.wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetzt);
    return s.wahl->ziel();
  }
  if (!g_freigabenErgaenzt) {
    g_freigabenErgaenzt = true;
    freigabenBefuellen(true);
  }
  const FreigabeEintrag* g = g_freigaben.gezeigt();
  s.shareUser = g != nullptr ? g->user : 0;
  return g != nullptr ? g->share : 0;
}

// Alle Freigabe-Slots folgen der gezeigten Freigabe (6.9): ein Wechsel haengt um.
void freigabeFolgen() {
  const FreigabeEintrag* g = g_freigaben.gezeigt();
  const unsigned share = g != nullptr ? g->share : 0;
  const unsigned user = g != nullptr ? g->user : 0;
  if (share == g_gezeigtShare && user == g_gezeigtUser) return;
  g_gezeigtShare = share;
  g_gezeigtUser = user;
  for (auto& [nr, s] : g_slots) {
    if (s->mode.load() != SlotMode::Share) continue;
    s->shareUser = user;
    slotRetarget(*s, SlotMode::Share, share, share != 0 ? Grund::shareChanged : Grund::shareNone);
  }
}

// Wiederholung nach 18 bzw. 29 (6.10): dasselbe Umhaengen, nur subscribe neu. Dass subscribe auf eine Freigabe sonst sofort Daten liefert, ist ANNAHME AN26 (unbelegt, MS27).
void wiederholungen(int64_t jetzt) {
  for (auto& [nr, s] : g_slots) {
    Abo& abo = s->abo();
    if (!abo.wiederholen || jetzt < abo.wiederholenAbMs || rendererSperre()) continue;
    abo.wiederholen = false;
    UmhaengLauf lauf;
    // N2a.2: Ziel, Modus und Grund des Umhaengens, das 18 bzw. 29 bekam (gemerkt bei WiederholenIn500ms) - nach 18
    // ist abo.target noch das alte Ziel. Den Merker abschlussGelaufen gibt subscribeAusfuehren weiter.
    // WIDERRUFEN seit dem Abschluss-Fix F2: auch nach 18 lief der Abschluss schon, abo.target ist das neue Ziel; die
    // gemerkten Werte bleiben die Quelle, weil die Wiederholung zu IHREM Umhaengen gehoert.
    lauf.ziel = abo.wiederholZiel;
    lauf.lage = lageFuer(*s, abo.wiederholModus, abo.wiederholZiel, abo.wiederholGrund);
    lauf.lage.modusVorher = abo.wiederholModusVorher;
    lauf.tonMitmelden = abo.wiederholTonMitmelden;   // F4: slotOn meldete den Ton schon selbst
    abo.umhaengen = true;
    // N2a.3 (6.10 Schritt 2, B32): kam onRendererBeDestroyed waehrend des Wartens, nie subscribe auf den toten
    // Renderer. Die Wiederholung gehoert zu DIESEM Umhaengen, also gilt dessen Schritt 2: umhaengPlan liefert ohne Abo
    // ZeigerVerwerfen, CreateRendererNeuerDelegate (scheitert er: fallback/subscribeFailed), dann Schritte 4-5.
    if (lauf.lage.rendererTot) planAusfuehren(*s, lauf, umhaengPlan(lauf.lage));
    else subscribeAusfuehren(*s, lauf);
    abo.subscribed = lauf.subscribeGeglueckt;
    abo.umhaengen = false;
  }
}

// --- Abbau-Ketten (Spec 6.15) ---------------------------------------------------------
// Welche Schritte eine Kette in welcher Reihenfolge ausfuehrt, liefert abbauPlan()
// (slot_logic.h, PB20). Hier steht nur der Ausfuehrer: ein Zweig je Schritt. Schritte,
// die einem Slot gelten (TonAusMelden bis InHalteliste), laufen fuer jeden Slot der
// Kette nacheinander; die uebrigen einmal, in Planreihenfolge.

// Halteliste (6.15, Nachfix W2): Slots, die waehrend der Renderer-Sperre abgebaut
// wurden, samt Abo, Renderer-Zeiger und Delegate. Sie zaehlen nirgends mehr, bekommen
// keinen Ton und melden nichts; ein spaeter Rueckruf trifft ein lebendes Objekt.
struct HalteEintrag {
  std::unique_ptr<Slot> slot;
  int meeting = 0;          // Nummer des Meetings, in dem der Eintrag entstand (join zaehlt)
};
std::vector<HalteEintrag> g_slotsHalt;
int g_meetingNr = 0;
// Meeting-Nummer eingefrorener Eintraege (Nachtrag N2b Fixrunde 1, G1): trifft nie (g_meetingNr beginnt bei 0 und
// zaehlt nur join hoch) - weder HaltelisteAbbauen noch HaltelisteVerwerfen fassen sie an, sie bleiben bis Prozessende.
constexpr int kMeetingEingefroren = -1;
bool g_sessionLeaveErgebnis = false;   // Rueckgabe von sessionLeave() fuer den Nachlauf-Plan

// Slots, bei denen nach RUECKRUF_FRIST_MS noch ein Rueckruf im Flug war (Abschluss-Fix F15): nie freigegeben, bis zum
// Prozessende (release ohne delete). Ihr Sender ist schon zu (SenderZu steht in jedem Plan vor SlotLoeschen und
// InHalteliste; slotOn schliesst ihn vorher selbst), sie stehen in keiner Karte und bekommen nichts mehr.
std::vector<Slot*> g_slotsImFlug;

// Vor JEDEM Freigeben eines Slots (Abschluss-Fix F15, Ruling): jeden Delegate, der auf ihn zeigt - den laufenden und alle
// frueher ausgemusterten -, abmelden, dann abwarten, bis keiner seiner Rueckrufe mehr im Flug ist. Der Hauptthread haelt
// dabei KEINE Sperre (kein fieldMutex, kein emitMutex): der Rueckruf nimmt emitMutex -> fieldMutex -> Sender-Sperre ->
// stdout und kann darum immer zu Ende laufen. Ruft das SDK einen Rueckruf synchron in unSubscribe/destroyRenderer auf dem
// Hauptthread, ist er vor deren Rueckkehr fertig; hier steht der Zaehler dann auf 0. Die Frist (500 ms, slot_logic.h)
// schliesst Haengen aus: false = noch im Flug, der Aufrufer gibt den Slot dann nicht frei. Nur Hauptthread.
bool slotFreigabeAbwarten(Slot& s) {
  for (Delegate* d : g_delegates) {
    if (d->zeigtAuf(&s)) rueckrufAbmelden(d->wache);
  }
  const int64_t bis = jetztMs() + RUECKRUF_FRIST_MS;
  bool frei = true;
  for (Delegate* d : g_delegates) {
    if (d->zeigtAuf(&s) && !rueckrufeAbwarten(d->wache, bis, jetztMs, [] { Sleep(1); })) frei = false;
  }
  if (!frei) {
    emitLog(L"Slot " + std::to_wstring(s.nr) + L": nach " + std::to_wstring(RUECKRUF_FRIST_MS) +
            L" ms laeuft noch ein Rueckruf - der Slot bleibt bis zum Prozessende stehen (Sender zu)");
  }
  return frei;
}

bool jeSlot(AbbauSchritt a) {
  switch (a) {
    case AbbauSchritt::TonAusMelden:
    case AbbauSchritt::SlotAusMelden:
    case AbbauSchritt::VorschauPlatzAbmelden:
    case AbbauSchritt::Unsubscribe:
    case AbbauSchritt::DestroyRenderer:
    case AbbauSchritt::ZeigerVerwerfen:
    case AbbauSchritt::SenderZu:
    case AbbauSchritt::SlotLoeschen:
    case AbbauSchritt::InHalteliste:
      return true;
    default:
      return false;
  }
}

TonGrund tonGrundFuer(Grund g) {
  if (g == Grund::meetingEnded) return TonGrund::meetingEnded;
  if (g == Grund::privilegeRevoked) return TonGrund::privilegeRevoked;
  return TonGrund::command;
}

// Nach INMEETING je Slot neu zuordnen (6.15 "Zoom verbindet selbst neu"): Teilnehmer
// Ziel 0 bis Connect neue Kennungen schickt (PK21), Sprecher Ziel 0 bis zum naechsten
// Signal, Freigabe die gezeigte Freigabe. Die Renderer bleiben dabei bestehen: ANNAHME AN25 (unbelegt, MS25).
// Ein waehrend der Sperre vorgemerkter Moduswechsel (6.10 Schritt 0) gilt hier (Nachtrag N2a.7): neu zugeordnet wird
// nach dem VORGEMERKTEN Modus. Sein vorgemerktes Ziel nicht - die Kennungen wechseln mit INMEETING (6.5, 6.15), das
// Ziel kommt je Modus wie oben. slotRetarget loescht die Vormerkung danach.
void alleNeuZuordnen() {
  const FreigabeEintrag* g = g_freigaben.gezeigt();
  g_gezeigtShare = g != nullptr ? g->share : 0;
  g_gezeigtUser = g != nullptr ? g->user : 0;
  for (auto& [nr, s] : g_slots) {
    const SlotMode m = s->vorgemerkt ? s->vorgemerktMode : s->mode.load();
    const bool modusNeu = m != s->mode.load();
    if (m == SlotMode::Participant) {
      slotRetarget(*s, m, 0, Grund::noTarget);
    } else if (m == SlotMode::Speaker) {
      s->wahl = neueWahl(*s);
      slotRetarget(*s, m, 0, Grund::speakerNone);
    } else {
      s->shareUser = g_gezeigtUser;
      // Mit gezeigter Freigabe bestaetigt modeChanged den vorgemerkten Wechsel; ohne gilt der Ziel-0-Grund (6.10 Schritt 3).
      slotRetarget(*s, m, g_gezeigtShare, g_gezeigtShare != 0 ? (modusNeu ? Grund::modeChanged : Grund::shareChanged) : Grund::shareNone);
    }
  }
}

// Ausfuehrer der Abbau-Ketten (6.15). nurNr != 0: nur dieser Slot (slotOff). Jede
// Renderer-Funktion liest vorher rendererSperre() (6.5). Abbau-Marken auf stderr,
// damit ein Absturz die Zeile benennt (Lehre vom 18.08.2026).
void abbauAusfuehren(Kette kette, Grund grund, bool verlassen = false, int nurNr = 0) {
  const std::vector<AbbauSchritt> plan = abbauPlan(kette, rendererSperre(), verlassen);
  emitLog(L"Abbau-Kette " + std::to_wstring(static_cast<int>(kette)) + L", Renderer-Sperre " +
          (rendererSperre() ? L"an" : L"aus") + L", " + std::to_wstring(plan.size()) + L" Schritte");
  // true = der Slot hat g_slots verlassen (geloescht oder in der Halteliste).
  auto schritt = [&](AbbauSchritt a, std::unique_ptr<Slot>* slot) -> bool {
    Slot* s = slot != nullptr ? slot->get() : nullptr;
    switch (a) {
      case AbbauSchritt::TonAusMelden:
        // Riegel zuerst: die Rueckrufe kehren ab hier sofort zurueck (6.10).
        s->imAbbau = true;
        for (auto& abo : s->abos) abo->subscribed = false;
        tonMelden(*s, TonZustand::Off, tonGrundFuer(grund));   // Ton vor Bild (6.15)
        return false;
      case AbbauSchritt::SlotAusMelden:
        emitSlotOff(*s, grund);
        return false;
      case AbbauSchritt::VorschauPlatzAbmelden:
        vorschauAbmelden(s->nr);   // VOR dem Loeschen (6.16)
        return false;
      case AbbauSchritt::Unsubscribe:
        for (auto& abo : s->abos) {
          if (abo->renderer != nullptr && !abo->rendererTot.load() && !rendererSperre()) {
            emitLog(L"Abbau Slot " + std::to_wstring(s->nr) + L": unSubscribe()");
            logSdkError(L"unSubscribe() beim Abbau", abo->renderer->unSubscribe());
          }
        }
        return false;
      case AbbauSchritt::DestroyRenderer:
        for (auto& abo : s->abos) {
          if (abo->renderer != nullptr && !abo->rendererTot.load() && !rendererSperre()) {
            emitLog(L"Abbau Slot " + std::to_wstring(s->nr) + L": destroyRenderer()");
            logSdkError(L"destroyRenderer() beim Abbau", destroyRenderer(abo->renderer));
          }
          abo->renderer = nullptr;
        }
        return false;
      case AbbauSchritt::ZeigerVerwerfen:
        // Meeting-Ende: Renderer NICHT anfassen (gemessener Absturz 0xC0000005,
        // README Abschnitt 8) - nur den Zeiger loslassen.
        for (auto& abo : s->abos) abo->renderer = nullptr;
        emitLog(L"Abbau Slot " + std::to_wstring(s->nr) + L": Renderer nicht angefasst");
        return false;
      case AbbauSchritt::SenderZu:
        s->sender.close();
        return false;
      case AbbauSchritt::SlotLoeschen:
        emitLog(L"Abbau Slot " + std::to_wstring(s->nr) + L": fertig");
        // Abschluss-Fix F1 (I-1): vor dem Loeschen den Delegate abmelden - ein spaeter Rueckruf (nach destroyRenderer
        // oder, am Meeting-Ende, ganz ohne Renderer-Aufruf) trifft dann einen lebenden Delegate, der nichts anfasst.
        for (auto& abo : s->abos) delegateAbmelden(*abo);
        // F15: einen Rueckruf im Flug abwarten, bevor g_slots.erase den Slot freigibt; nach der Frist bleibt er stehen.
        if (!slotFreigabeAbwarten(*s)) g_slotsImFlug.push_back(slot->release());
        return true;
      case AbbauSchritt::InHalteliste:
        // Renderer-Sperre: weder unSubscribe noch destroyRenderer, und der Delegate
        // wird nicht frei - der ganze Slot wartet in der Halteliste (W2).
        emitLog(L"Slot " + std::to_wstring(s->nr) + L": in die Halteliste (Abbau waehrend der Renderer-Sperre)");
        g_slotsHalt.push_back(HalteEintrag{std::move(*slot), g_meetingNr});
        return true;
      case AbbauSchritt::AudioShutdown:
        audioShutdown();
        return false;
      case AbbauSchritt::AudioClearSubscribed:
        audioClearSubscribed();
        return false;
      case AbbauSchritt::HaltelisteAbbauen:
        // INMEETING desselben Meetings, nach dem Loesen der Sperre: je Eintrag
        // unSubscribe + destroyRenderer (bei rendererTot keins), dann loeschen. ANNAHME AN25 (unbelegt, MS25): die gehaltenen Renderer sind nach der eigenen Wiederverbindung noch gueltig.
        // Abschluss-Fix F3 (SG1, SG2, M3): Zugehoerigkeit und Renderer-Aufrufe je Eintrag entscheiden die getesteten
        // Helfer halteEintragGehoertZu und halteEintragAbbauen (PB20) statt einer Nachbildung; die Sperre bleibt die
        // zweite Schranke. Vor dem Loeschen den Delegate abmelden (F1).
        for (auto it = g_slotsHalt.begin(); it != g_slotsHalt.end();) {
          if (!halteEintragGehoertZu(static_cast<uint32_t>(it->meeting), static_cast<uint32_t>(g_meetingNr)) || rendererSperre()) { ++it; continue; }
          for (auto& abo : it->slot->abos) {
            for (const AbbauSchritt h : halteEintragAbbauen(abo->rendererTot.load())) {
              if (abo->renderer == nullptr) break;
              if (h == AbbauSchritt::Unsubscribe) logSdkError(L"unSubscribe() beim Abbau der Halteliste", abo->renderer->unSubscribe());
              if (h == AbbauSchritt::DestroyRenderer) logSdkError(L"destroyRenderer() beim Abbau der Halteliste", destroyRenderer(abo->renderer));
            }
            abo->renderer = nullptr;
            delegateAbmelden(*abo);
          }
          emitLog(L"Slot " + std::to_wstring(it->slot->nr) + L": aus der Halteliste abgebaut (INMEETING)");
          if (!slotFreigabeAbwarten(*it->slot)) g_slotsImFlug.push_back(it->slot.release());   // F15
          it = g_slotsHalt.erase(it);
        }
        return false;
      case AbbauSchritt::HaltelisteVerwerfen:
        // Meeting zu Ende bzw. leave mit Ruhezustand: loeschen OHNE Renderer-Aufruf.
        for (auto it = g_slotsHalt.begin(); it != g_slotsHalt.end();) {
          if (it->meeting != g_meetingNr) { ++it; continue; }
          for (auto& abo : it->slot->abos) {
            abo->renderer = nullptr;
            delegateAbmelden(*abo);   // Abschluss-Fix F1: vor dem Loeschen abmelden, der Delegate lebt weiter
          }
          emitLog(L"Slot " + std::to_wstring(it->slot->nr) + L": aus der Halteliste verworfen (ohne Renderer-Aufruf)");
          if (!slotFreigabeAbwarten(*it->slot)) g_slotsImFlug.push_back(it->slot.release());   // F15
          it = g_slotsHalt.erase(it);
        }
        return false;
      case AbbauSchritt::HaltelisteEinfrieren:
        // leave mit sessionLeave() false (6.15): die Eintraege dieses Meetings bleiben bis zum Prozessende - kein
        // Renderer-Aufruf, kein Delegate wird frei. Nur die Nummer wechselt, damit ein spaeteres INMEETING desselben
        // Meetings (leave aendert g_meetingNr nicht) sie nicht abbaut und ein Meeting-Ende sie nicht verwirft.
        for (HalteEintrag& e : g_slotsHalt) {
          if (e.meeting == g_meetingNr) e.meeting = kMeetingEingefroren;
        }
        return false;
      case AbbauSchritt::FreigabenLeeren:
        g_freigaben.leeren();
        g_gezeigtShare = g_gezeigtUser = 0;
        g_freigabenErgaenzt = false;   // F8 e: der naechste erste Freigabe-Slot ergaenzt wieder
        return false;
      case AbbauSchritt::ErinnerungLeeren:
        g_erinnerung.leeren();
        return false;
      case AbbauSchritt::VorschauThreadEnde:
        vorschauThreadEnde();
        return false;
      case AbbauSchritt::StopRawRecording:
        sessionStopRawRecording();
        return false;
      case AbbauSchritt::SessionLeave:
        g_sessionLeaveErgebnis = sessionLeave();
        return false;
      case AbbauSchritt::SperreAn:
        return false;   // setzt der Rueckruf selbst bei DISCONNECTING/RECONNECTING (callbacks.cpp)
      case AbbauSchritt::SperreLoesen:
        // Nachtrag N2b.1 (6.5): die INMEETING-Kette loest nur, wenn der zuletzt gemeldete Status noch im Meeting ist -
        // ein ueberholtes INMEETING laesst die Sperre stehen (HaltelisteAbbauen und das Umhaengen lesen sie danach);
        // das naechste echte INMEETING bzw. das Meeting-Ende loest sie. Das Meeting-Ende loest immer.
        // Die stderr-Zeile nur, wenn wirklich eine Sperre stehen bleibt (Fixrunde 1, G2).
        if (sperreLoesenErlaubt(kette, callbacksStatusImMeeting())) callbacksRendererSperreLoesen();
        else if (rendererSperre()) emitLog(L"INMEETING ist ueberholt (Zoom meldet inzwischen einen anderen Status) - Renderer-Sperre bleibt");
        return false;
      case AbbauSchritt::EigeneKennungNeu:
        sessionEigeneKennungNeu();
        return false;
      case AbbauSchritt::FreigabenBefuellen:
        freigabenBefuellen(false);
        return false;
      case AbbauSchritt::UmhaengenVormerken:
        alleNeuZuordnen();
        return false;
    }
    return false;
  };
  size_t i = 0;
  while (i < plan.size()) {
    if (!jeSlot(plan[i])) {
      schritt(plan[i], nullptr);
      ++i;
      continue;
    }
    size_t j = i;
    while (j < plan.size() && jeSlot(plan[j])) ++j;
    for (auto it = g_slots.begin(); it != g_slots.end();) {
      if (nurNr != 0 && it->first != nurNr) { ++it; continue; }
      bool weg = false;
      for (size_t k = i; k < j && !weg; ++k) weg = schritt(plan[k], &it->second);
      it = weg ? g_slots.erase(it) : std::next(it);
    }
    i = j;
  }
}

// --- Ton-Zuordnung und Messung (Spec 6.13; Person-Ton ab A11, alle Arten ab A15) ----

std::vector<TonSlotSicht> tonSicht() {
  std::vector<TonSlotSicht> v;
  for (auto& [nr, s] : g_slots) {
    // Abschluss-Fix F11 (M5): ein Slot auf off/audioUnavailable bekommt keinen Ton, bis an ihm Ton wieder an ist (6.13).
    v.push_back(TonSlotSicht{nr, !s->imAbbau.load(), s->mode.load(), s->abo().target.load(), s->audio.load(),
                             s->shareAudio.load(), s->shareUser.load(), s->tonAudioUnavailable});
  }
  return v;
}

// Diagnosezeilen je Slot (A-EP18, frueher je Abo video.cpp:904-957): einmal je
// Fenster, erst 1 s, dann je 10 s. Nur Slot-Nummer, nie ein Name (PT6 d).
void tonMessungMelden(Slot& s, const TonStand& m, int64_t spanne, bool erstes) {
  const int64_t jeSekunde = m.audioMessAbtastwerte * 1000 / (spanne > 0 ? spanne : 1);
  emitLog(std::wstring(L"Ton-Messung Slot ") + std::to_wstring(s.nr) +
          (erstes ? L" [ANLAUF, nicht der Dauerbetrieb]" : L" [Dauerbetrieb]") + L": " +
          std::to_wstring(m.audioMessPakete) + L" Pakete in " + std::to_wstring(spanne) + L" ms, " +
          std::to_wstring(m.audioMessAbtastwerte) + L" Abtastwerte je Kanal = " + std::to_wstring(jeSekunde) +
          L"/s gesendet. Zoom gibt " + std::to_wstring(m.audioRate) + L" Hz, " + std::to_wstring(m.audioChannels) +
          L" Kanal an.");
  if (m.audioMessPakete > 0) {
    emitLog(std::wstring(L"Ton-Wartezeit Slot ") + std::to_wstring(s.nr) + (erstes ? L" [ANLAUF]" : L" [Dauerbetrieb]") +
            L" (Warteschlange -> Senden): mittel " + std::to_wstring(m.audioWartenSummeUs / m.audioMessPakete) +
            L" us, min " + std::to_wstring(m.audioWartenMinUs) + L" us, max " + std::to_wstring(m.audioWartenMaxUs) + L" us.");
  }
}

// GEPRUEFT, NICHT GEGLAUBT (wie bisher): eine Pufferlaenge, die nicht zur Kanalzahl
// passt, ergibt Rauschen. Gemeldet einmal je Ton-Stand (audioBufferMismatch mit slot).
bool pufferPasst(Slot& s, const AudioPacket& p) {
  if (p.sampleCount > 0 && p.bufferLen % (sizeof(int16_t) * static_cast<unsigned int>(p.channels)) == 0) return true;
  bool melden = false;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    if (!s.ton.audioMismatchGemeldet) { s.ton.audioMismatchGemeldet = true; melden = true; }
  }
  if (melden) emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioBufferMismatch\",\"slot\":" + std::to_string(s.nr) + "}");
  return false;
}

// Ein Paket in den Mischer (6.13): Mischton in Eingang A, Computerton in Eingang B. Das
// Format des Stroms waehlt der Mischer (rate()/kanaele(): der Computerton, sobald er da ist, und
// bei Raten-Unterschied allein; sonst der Mischton). Alle Ton-Wege mono 32 kHz ist nur angenommen, gemessen wird je Paket: ANNAHME AN12 (unbelegt).
void mischerEinspeisen(Slot& s, const AudioPacket& p, Weg weg, int64_t jetzt) {
  if (!pufferPasst(s, p)) return;
  if (weg == Weg::MischerA) {
    s.mix.eingangA(p.samples.data(), p.sampleCount, p.sampleRate, p.channels, jetzt);
    s.tonFensterMischA = true;
  } else {
    s.mix.eingangB(p.samples.data(), p.sampleCount, p.sampleRate, p.channels, jetzt);
    s.tonFensterMischB = true;
    s.shareRate = p.sampleRate;
    s.shareCh = p.channels;
  }
  s.audioPakete.fetch_add(1);
  std::lock_guard<std::mutex> lock(s.fieldMutex);
  // Nachtrag N2b.3 (Task-15-Review I1): slotAudio.sampleRate/channels nennen das Format, in dem der Mischer schreibt -
  // nach einem Freigabewechsel (Eingang B leer) oder einem Formatwechsel von A ohne B ist das nicht das letzte Paket.
  s.ton.audioRate = s.mix.rate();
  s.ton.audioChannels = s.mix.kanaele();
  s.ton.lastAudioMs = jetzt;
}

// Mischer-Ausgabe je Herzschlag (6.13, B17): genau die verstrichene Zeit in 10-ms-
// Schritten, nie mehr Ton als Wanduhrzeit. Raten-Unterschied: nur der Computerton,
// slotAudio rateMismatch (T76).
void mischerAusgeben(Slot& s, int64_t jetzt) {
  if (tonWeg(s.mode.load(), s.audio.load(), s.shareAudio.load()) != TonQuelle::MixShare) return;
  std::vector<int16_t> aus;
  const int n = s.mix.ausgabe(jetzt, aus);
  if (s.mix.rateMismatch() && !s.rateMismatchGemeldet && !s.tonAudioUnavailable) {
    s.rateMismatchGemeldet = true;
    tonMelden(s, TonZustand::Live, TonGrund::rateMismatch);
  }
  if (n <= 0) return;
  // Nachtrag N2b.3: im Format, in dem ausgabe() geschrieben hat (rate()/kanaele(), n Abtastwerte je Kanal) - ein
  // daneben gefuehrtes Format beschriftete die Abtastwerte falsch (Tempo, Tonhoehe, Kanaele). n > 0 heisst: Format da.
  s.sender.sendAudio(aus.data(), n, s.mix.rate(), s.mix.kanaele());
  if (s.tonZustand != TonZustand::Live && !s.tonAudioUnavailable) tonMelden(s, TonZustand::Live, TonGrund::packets);
}

// Ein Paket an einen Slot (Weg direkt). Prueft die Pufferlaenge je Paket; meldet eine
// falsche einmal je Ton-Stand (audioBufferMismatch mit slot, 6.4).
void paketSenden(Slot& s, const AudioPacket& p, int64_t jetzt) {
  if (!pufferPasst(s, p)) return;
  s.sender.sendAudio(p.samples.data(), p.sampleCount, p.sampleRate, p.channels);
  TonStand fertig;
  bool messungFertig = false, erstes = false;
  int64_t spanne = 0;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    TonStand& t = s.ton;
    t.audioRate = p.sampleRate;
    t.audioChannels = p.channels;
    t.lastAudioMs = jetzt;
    if (t.audioMessBeginnMs == 0) t.audioMessBeginnMs = jetzt;
    ++t.audioMessPakete;
    t.audioMessAbtastwerte += p.sampleCount;
    if (p.eingangTick > 0) {
      const int64_t us = static_cast<int64_t>(qpcUs(p.eingangTick, qpcJetzt()));
      t.audioWartenSummeUs += us;
      if (us > t.audioWartenMaxUs) t.audioWartenMaxUs = us;
      if (t.audioWartenMinUs == 0 || us < t.audioWartenMinUs) t.audioWartenMinUs = us;
    }
    spanne = jetzt - t.audioMessBeginnMs;
    if (spanne >= (t.audioMessFenster == 0 ? 1000 : 10000)) {
      erstes = t.audioMessFenster == 0;
      fertig = t;
      messungFertig = true;
      ++t.audioMessFenster;
      t.audioMessBeginnMs = jetzt;
      t.audioMessPakete = 0;
      t.audioMessAbtastwerte = 0;
      t.audioWartenSummeUs = t.audioWartenMaxUs = t.audioWartenMinUs = 0;
    }
  }
  s.audioPakete.fetch_add(1);
  if (p.kind == AudioArt::Share) { s.shareRate = p.sampleRate; s.shareCh = p.channels; }
  if (p.kind == AudioArt::Person) s.tonFensterPerson = true;
  else if (p.kind == AudioArt::Mix) s.tonFensterMix = true;
  else s.tonFensterShare = true;
  if (s.tonZustand != TonZustand::Live && !s.tonAudioUnavailable &&
      !(s.audio.load() == SlotAudio::Person && s.mode.load() != SlotMode::Participant)) {
    tonMelden(s, TonZustand::Live, TonGrund::packets);
  }
  if (messungFertig) tonMessungMelden(s, fertig, spanne, erstes);
}

// Gemessene Quelle (6.3, slotAudio.source): was im letzten 500-ms-Fenster hinausging.
void tonQuelleMessen(Slot& s, int64_t jetzt) {
  if (s.tonFensterBeginnMs == 0) s.tonFensterBeginnMs = jetzt;
  if (jetzt - s.tonFensterBeginnMs < 500) return;
  TonQuelle q = TonQuelle::None;
  if (s.tonFensterPerson) q = TonQuelle::Person;
  else if (s.tonFensterMischA && s.tonFensterMischB) q = TonQuelle::MixShare;
  else if (s.tonFensterMix || s.tonFensterMischA) q = TonQuelle::Mix;
  else if (s.tonFensterShare || s.tonFensterMischB) q = TonQuelle::Share;
  s.tonFensterBeginnMs = jetzt;
  s.tonFensterPerson = s.tonFensterMix = s.tonFensterShare = s.tonFensterMischA = s.tonFensterMischB = false;
  if (q != s.tonSource) {
    s.tonSource = q;
    emitSlotAudio(s);
  }
}

// Stille-Herzschlag je Slot (6.13): wie viel, entscheidet stilleBloecke().
void stilleSenden(Slot& s, int64_t jetzt) {
  const TonQuelle weg = tonWeg(s.mode.load(), s.audio.load(), s.shareAudio.load());
  // Mischer-Slots: der Mischer liefert die Stille selbst (6.13, 0.35).
  if (weg == TonQuelle::MixShare) return;
  TonStand t;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    t = s.ton;
  }
  const StilleErgebnis r = stilleBloecke(weg, s.abo().target.load(), t, jetzt);
  if (r.abtastwerte <= 0) return;
  s.sender.sendSilence(r.abtastwerte, t.audioRate, t.audioChannels);
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    s.ton.silenceBisMs = r.neuerSilenceBisMs;
  }
  if (s.tonZustand == TonZustand::Live) tonMelden(s, TonZustand::Silent, TonGrund::gap);
}

// --- Ersatzbild-Herzschlag (Spec 6.12) -----------------------------------------------

void ersatzbildTick(Slot& s, int64_t jetzt) {
  Abo& abo = s.abo();
  ZielStand z;
  BildLage lage{};
  int lastW = 0, lastH = 0;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    z = abo.ziel;
    lage.zustand = s.state;
    lage.grund = s.grund;
    lage.bufferMismatch = s.bufferMismatch;
    lastW = abo.ziel.lastW;
    lastH = abo.ziel.lastH;
  }
  // RawData_Off nach dem ersten Bild dieses Ziels: nur die Abfrage IsVideoOn() (6.7). Waehrend der Renderer-Sperre
  // wartet sie (Abschluss-Fix F13, M7): der Merker bleibt stehen, gefragt wird nach der Sperre.
  if (z.rawOffGesehen && !rendererSperre()) {
    {
      std::lock_guard<std::mutex> lock(s.fieldMutex);
      abo.ziel.rawOffGesehen = false;
    }
    if (s.mode.load() != SlotMode::Share) s.kameraAus = !kameraAn(abo.target.load());
  }
  lage.modus = s.mode.load();
  lage.fallback = s.fallback.load();
  lage.ziel = abo.target.load();
  // Freigabe-Slot: besteht die gezeigte Freigabe noch, und ist sie pausiert (6.9)?
  const FreigabeEintrag* gezeigt = g_freigaben.gezeigt();
  const bool dieseFreigabe = lage.modus == SlotMode::Share && lage.ziel != 0 && gezeigt != nullptr && gezeigt->share == lage.ziel;
  lage.freigabeBesteht = dieseFreigabe;
  lage.freigabePausiert = dieseFreigabe && gezeigt->paused;
  lage.kameraAusLautZoom = s.kameraAus;
  lage.kameraGefragt = s.kameraGefragtBildMs == z.lastFrameMs;
  lage.letztesErsatzMs = s.letztesErsatzMs;
  lage.jetzt = jetzt;
  BildEntscheidung e = bildEntscheidung(lage, z);
  if (e.kameraFragen && !rendererSperre()) {
    // #285/#286: In der Schonfrist (2 s) gibt es den Uebergang nach 200 ms nicht mehr; damit Kamera aus wie bisher
    // nach 200 ms greift, einmal je Luecke fragen. Waehrend der Sperre weder fragen noch merken (wie kameraAn, F13).
    s.kameraGefragtBildMs = z.lastFrameMs;
    if (!kameraAn(lage.ziel)) {
      s.kameraAus = true;
      lage.kameraAusLautZoom = true;
      e = bildEntscheidung(lage, z);
    }
  }
  if (e.zustandAendern && lage.modus != SlotMode::Share && !lage.kameraAusLautZoom && !kameraAn(lage.ziel)) {
    // Uebergang nach 200 ms ohne Bild: Zoom fragen, bevor ein Grund steht (6.12).
    s.kameraAus = true;
    lage.kameraAusLautZoom = true;
    e = bildEntscheidung(lage, z);
  }
  if (e.jetztSenden && e.sent != Sent::None) {
    const int w = lastW > 0 ? lastW : nominalWidth(s.res);
    const int h = lastH > 0 ? lastH : nominalHeight(s.res);
    const long long t0 = qpcJetzt();
    switch (e.sent) {
      case Sent::Transparent: s.sender.sendTransparent(w, h); break;
      case Sent::Black:       s.sender.sendBlack(w, h); break;
      case Sent::White:       s.sender.sendWhite(w, h); break;
      case Sent::Freeze:
      case Sent::Held:        s.sender.sendCopy(s.last); break;
      case Sent::None:        break;
    }
    s.workUs.fetch_add(qpcUs(t0, qpcJetzt()));
    s.letztesErsatzMs = jetzt;
    // Nachtrag N2b.5 (Spec 6.17: fallbackFps = gesendete Ersatz- UND Haltebilder je Sekunde; 12, FR9): jedes Bild des
    // Herzschlags zaehlt in fallbackCount, ein Haltebild zusaetzlich in heldFrames (je Ziel, ZielStandNeu setzt zurueck).
    s.fallbackCount.fetch_add(1);
    if (e.sent == Sent::Held) s.heldFrames.fetch_add(1);
  }
  bool melden = false;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    // Nur, wenn seit dem Entscheiden kein Bild kam (der Rueckruf hat sonst schon
    // live/frames gesetzt): eine veraltete Entscheidung meldet nichts.
    if (abo.ziel.lastFrameMs == z.lastFrameMs) {
      if (e.sent != s.sent) { s.sent = e.sent; melden = true; }
      if (e.zustandAendern && (e.zustand != s.state || e.grund != s.grund)) {
        s.state = e.zustand;
        s.grund = e.grund;
        melden = true;
      }
    }
  }
  if (melden) emitSlot(s);
}

// --- Messwerte (Spec 6.17) -------------------------------------------------------------
// slotStats alle 2 s je laufendem Slot. Pflichtfelder immer, Messfelder nur, wenn
// gemessen (Regel "keine erfundenen Werte", 6.3; nach jedem Umhaengen fehlen sie wieder).
void slotStatsMelden(Slot& s, int64_t jetzt) {
  if (s.statsBeginnMs == 0) {
    s.statsBeginnMs = jetzt;
    s.statsFrames = s.frameCount.load();
    s.statsFallback = s.fallbackCount.load();
    s.statsWork = s.workUs.load();
    s.statsCopy = s.copyUs.load();
    s.statsAudio = s.audioPakete.load();
    return;
  }
  const int64_t spanne = jetzt - s.statsBeginnMs;
  if (spanne < 2000) return;
  // fps und audioPps rechnen ab dem Umhaengen, wenn es in diesem Fenster lag (B55); nie durch 0.
  const int64_t beginn = s.statsBeginnMs;
  const int64_t zielBeginn = s.statsZielBeginnMs > beginn ? s.statsZielBeginnMs : beginn;
  const uint64_t zielMs = jetzt > zielBeginn ? static_cast<uint64_t>(jetzt - zielBeginn) : 1;
  const uint64_t frames = s.frameCount.load() - s.statsFrames;
  const uint64_t ersatz = s.fallbackCount.load() - s.statsFallback;
  const uint64_t work = s.workUs.load() - s.statsWork;
  const uint64_t copy = s.copyUs.load() - s.statsCopy;
  const uint64_t pakete = s.audioPakete.load() - s.statsAudio;
  s.statsBeginnMs = jetzt;
  s.statsFrames += frames;
  s.statsFallback += ersatz;
  s.statsWork += work;
  s.statsCopy += copy;
  s.statsAudio += pakete;
  Abo& abo = s.abo();
  ZielStand z;
  TonStand t;
  int64_t gap = -1;
  bool gapUngeprueft = false;
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    z = abo.ziel;
    t = s.ton;
    gap = s.gapMs;
    gapUngeprueft = s.gapUngeprueft;
  }
  const SlotMode mode = s.mode.load();
  const unsigned ziel = abo.target.load();
  const bool mischer = tonWeg(mode, s.audio.load(), s.shareAudio.load()) == TonQuelle::MixShare;
  size_t kopie = 0;
  if (s.last.m.try_lock()) {
    kopie = s.last.i420.capacity();
    s.last.m.unlock();
  }
  const auto jeSekunde = [&](uint64_t n) { return std::to_string(n * 1000 / static_cast<uint64_t>(spanne)); };
  std::string out = "{\"ev\":\"slotStats\",\"slot\":" + std::to_string(s.nr);
  auto pflicht = [&](const char* name, const std::string& v) { out += std::string(",\"") + name + "\":" + v; };
  auto wenn = [&](bool gemessen, const char* name, const std::string& v) { if (gemessen) pflicht(name, v); };
  // w, h, fps nur aus Bildern dieses Fensters UND dieses Ziels (B55): nach dem Umhaengen
  // fehlen sie, bis ein Bild des neuen Ziels kam; ohne Bild nur die letzte Groesse des Ziels.
  const bool bildDa = frames > 0 && z.bildSeitUmhaengen;
  wenn(bildDa, "w", std::to_string(z.lastW));
  wenn(bildDa, "h", std::to_string(z.lastH));
  wenn(!bildDa && z.lastW > 0, "lastW", std::to_string(z.lastW));
  wenn(!bildDa && z.lastH > 0, "lastH", std::to_string(z.lastH));
  wenn(bildDa, "fps", std::to_string(frames * 10000 / zielMs / 10) + "." + std::to_string(frames * 10000 / zielMs % 10));
  pflicht("fallbackFps", jeSekunde(ersatz));
  pflicht("heldFrames", std::to_string(s.heldFrames.load()));
  pflicht("workUs", jeSekunde(work));     // Bridge-Anteil je Sekunde (ANNAHME AN4: NDI sendet synchron)
  pflicht("copyUs", jeSekunde(copy));
  pflicht("previewUs", jeSekunde(vorschauKostenUs(s.nr)));
  pflicht("memKb", std::to_string((s.sender.speicherBytes() + kopie + vorschauSpeicherBytes(s.nr)) / 1024));
  pflicht("resWanted", std::string("\"") + (s.res == ZoomSDKResolution_360P ? "360p" : s.res == ZoomSDKResolution_1080P ? "1080p" : "720p") + "\"");
  wenn(s.resSet >= 0, "resSet", std::to_string(s.resSet));
  wenn(s.resGot >= 0, "resGot", std::to_string(s.resGot));
  wenn(s.rawType >= 0, "rawType", std::to_string(s.rawType));
  if (!rendererSperre() && mode != SlotMode::Share && ziel != 0 && videoCtrl() != nullptr) {
    // GetUserVideoSize: Bedeutung ungeklaert (MS24) - nur ein Messwert. Nicht waehrend der Renderer-Sperre
    // (Abschluss-Fix F13, M7); die Felder fehlen dann. Die Sperre steht ZUERST (Restpunkt R-b der Nachpruefung):
    // videoCtrl() ist selbst ein SDK-Aufruf (GetMeetingVideoController, session.cpp).
    const VideoSize gross = videoCtrl()->GetUserVideoSize(ziel);
    wenn(gross.width > 0, "userVideoW", std::to_string(gross.width));
    wenn(gross.height > 0, "userVideoH", std::to_string(gross.height));
  }
  pflicht("foreignFrames", std::to_string(s.foreignFrames.load()));
  pflicht("lateFrames", std::to_string(s.lateFrames.load()));
  pflicht("tooFrequent", std::to_string(s.tooFrequent.load()));
  pflicht("noShareData", std::to_string(s.noShareData.load()));
  pflicht("rendererNew", std::to_string(s.rendererNew.load()));
  pflicht("rendererLost", std::to_string(s.rendererLost.load()));
  wenn(gap >= 0, "gapMs", std::to_string(gap));
  wenn(gap >= 0, "gapUngeprueft", gapUngeprueft ? "true" : "false");
  wenn(pakete > 0, "audioPps", std::to_string(pakete * 1000 / zielMs));
  wenn(t.audioRate > 0 && !mischer, "audioRate", std::to_string(t.audioRate));
  wenn(t.audioRate > 0 && !mischer, "audioCh", std::to_string(t.audioChannels));
  wenn(s.shareRate > 0, "shareAudioRate", std::to_string(s.shareRate));
  wenn(s.shareRate > 0, "shareAudioCh", std::to_string(s.shareCh));
  wenn(mischer, "mixDrops", std::to_string(s.mix.mixDropsMs()));
  wenn(mischer, "mixSilenceMs", std::to_string(s.mix.mixSilenceMs()));
  emitRaw(out + "}");
}

// Versatz-Zaehler je Slot alle 10 s (A-EP18, frueher je Abo video.cpp:968-984).
void versatzZaehlerMelden(Slot& s, int64_t jetzt) {
  if (s.versatzMessBeginnMs == 0) { s.versatzMessBeginnMs = jetzt; return; }
  if (jetzt - s.versatzMessBeginnMs < 10000) return;
  s.versatzMessBeginnMs = jetzt;
  const NdiSender::DelayZaehler z = s.sender.takeDelayZaehler();
  if (z.beimEinreihen + z.imNachlauf + z.verworfen == 0) return;
  emitLog(std::wstring(L"Bild-Versatz ") + std::to_wstring(ndiVideoDelayMs()) + L" ms fuer Slot " + std::to_wstring(s.nr) +
          L" [10 s]: " + std::to_wstring(z.beimEinreihen) + L" Bilder im Takt der Ankunft, " +
          std::to_wstring(z.imNachlauf) + L" im Nachlauf, " + std::to_wstring(z.verworfen) + L" verworfen.");
}

}  // namespace

// --- Oeffentlich ---------------------------------------------------------------------

bool slotParseResolution(const std::string& key, ZoomSDKResolution* out) {
  if (key == "360p")  { *out = ZoomSDKResolution_360P;  return true; }
  if (key == "720p")  { *out = ZoomSDKResolution_720P;  return true; }
  if (key == "1080p") { *out = ZoomSDKResolution_1080P; return true; }
  return false;
}

const char* slotAufloesungName(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_360P:  return "360p";
    case ZoomSDKResolution_720P:  return "720p";
    case ZoomSDKResolution_1080P: return "1080p";
    default:                      return "unbekannt";
  }
}

void emitSlotFehler(const char* code, int nr) {
  if (nr > 0) {
    emitRaw(std::string("{\"ev\":\"error\",\"where\":\"slot\",\"code\":\"") + code + "\",\"slot\":" + std::to_string(nr) + "}");
  } else {
    emitRaw(std::string("{\"ev\":\"error\",\"where\":\"slot\",\"code\":\"") + code + "\"}");
  }
}

bool slotLaeuft(int nr) { return g_slots.count(nr) != 0; }

bool slotNameBelegt(const std::string& ndi, int ausser) {
  for (const auto& [nr, s] : g_slots) {
    if (nr != ausser && s->ndi == ndi) return true;   // nur ANDERE laufende Slots (Gliederung 3.2 Nr. 3)
  }
  return false;
}

void slotOn(const SlotBefehl& b) {
  // 8. Renderer-Sperre (6.5): nichts anlegen (Nachfix W2).
  if (rendererSperre()) { emitSlotFehler("slotReconnecting", b.nr); return; }
  // 9. Erlaubnis ist Voraussetzung, kein Wunsch.
  if (!sessionCanRecordRaw()) { emitSlotFehler("slotNoPrivilege", b.nr); return; }
  // 10. Fehlende NDI-Laufzeit hat ihren eigenen Namen (where:"ndi", wie main.cpp).
  if (!ndiIsUp()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
    return;
  }
  // 11. Aufbau. StartRawRecording ist der Schalter fuer die Rohdaten-Rueckrufe (der
  // Name luegt, session.h); idempotent je Meeting.
  const SDKError rawErr = sessionStartRawRecording();
  if (rawErr != SDKERR_SUCCESS) {
    logSdkError(L"StartRawRecording()", rawErr);
    emitSlotFehler("slotRawRecordingFailed", b.nr);
    return;
  }
  auto slot = std::make_unique<Slot>();
  Slot& s = *slot;
  s.nr = b.nr;
  s.ndi = b.ndi;
  s.mode = b.mode;
  s.res = b.res;
  s.audio = b.audio;
  s.shareAudio = b.shareAudio;
  s.fallback = b.fallback;
  s.showNoVideo = b.showNoVideo;
  s.abos.push_back(std::make_unique<Abo>());
  Abo& abo = s.abo();
  abo.type = rohTyp(b.mode);
  if (!s.sender.open(s.ndi)) { emitSlotFehler("slotSenderFailed", b.nr); return; }
  // Freigabe-Slots senden ohne den Bild-Versatz der Personen (6.14, E11; Nachtrag N2a.5). slotOn ist kein
  // Moduswechsel, umhaengPlan plant hier kein OhneVersatzSetzen; die Warteschlange des neuen Senders ist leer.
  s.sender.setOhneVersatz(b.mode == SlotMode::Share);
  abo.delegate = neuerDelegate(s, abo);
  const SDKError err = rendererAnlegen(abo);
  if (err != SDKERR_SUCCESS) {
    logSdkError(L"createRenderer()", err);
    emitLog(std::wstring(L"createRenderer() lieferte keinen Renderer. HasRawdataLicense()=") +
            (HasRawdataLicense() ? L"true" : L"false"));
    delegateAbmelden(abo);   // Abschluss-Fix F1: der Slot wird gleich frei, der Delegate lebt weiter (g_delegates)
    s.sender.close();
    if (!slotFreigabeAbwarten(s)) g_slotsImFlug.push_back(slot.release());   // F15, wie jede Freigabestelle
    emitSlotFehler("slotRendererFailed", b.nr);
    return;
  }
  g_slots[b.nr] = std::move(slot);
  vorschauAnmelden(b.nr);
  // Erstes Ziel nach Modus (6.7-6.9): Teilnehmer die Kennung aus dem Befehl (geprueft,
  // teilnehmerZiel), Sprecher aus der Sprecher-Erinnerung, Freigabe die gezeigte Freigabe.
  const unsigned ziel = zielNachModus(s, b.mode, b.id, jetztMs());
  slotRetargetIntern(s, b.mode, ziel, Grund::command, false);
  // Ton (6.13, W6, N9-1): audioEnsureSubscribed() genau dann, wenn tonAboNoetig(); den Plan gibt tonUmschaltPlan.
  // Mit dem gewuenschten Ziel (F4): bekam das erste Umhaengen 18, ist abo.target noch 0 - eine gezeigte Freigabe
  // hiesse sonst off/noShare.
  UmhaengLage l = lageFuer(s, b.mode, zielImLauf(abo), Grund::command);
  l.modusVorher = b.mode;
  const TonAenderung aenderung{true, b.audio, true, b.shareAudio};
  const AboErgebnis aboErg = tonAboNoetig(l, aenderung) ? (audioEnsureSubscribed(b.nr) ? AboErgebnis::Geglueckt : AboErgebnis::Gescheitert)
                                                        : AboErgebnis::NichtGerufen;
  const UmhaengPlan tp = tonUmschaltPlan(l, aenderung, aboErg);
  s.tonConfigured = tp.configured;
  s.tonAudioUnavailable = aboErg == AboErgebnis::Gescheitert;
  for (const TonMeldung& m : tp.tonFolge) tonMelden(s, m.zustand, m.grund);   // E-a2-7: jede Meldung in Reihenfolge
}

void slotSet(const SlotAenderung& a) {
  auto it = g_slots.find(a.nr);
  if (it == g_slots.end()) { emitSlotFehler("slotNotOn", a.nr); return; }
  Slot& s = *it->second;
  Abo& abo = s.abo();
  // Abschluss-Fix F7 (6.2): merkt die Renderer-Sperre das Umhaengen dieses Befehls nur vor, bestaetigt
  // slotRetargetIntern ihn; der Aufraeumer loescht den Merker auf jedem Weg aus slotSet.
  s.slotSetLaeuft = true;
  struct SlotSetEnde {
    Slot* s;
    ~SlotSetEnde() { s->slotSetLaeuft = false; }
  } ende{&s};
  // Reihenfolge (6.2): fallback, showNoVideo, Ton, dann hoechstens EIN Umhaengen.
  if (a.fallbackGesetzt) s.fallback = a.fallback;
  bool sprecherWechsel = false;   // N2a.6: die neue Wahl zeigt jemand anderen als das Abo; umgehaengt wird unten
  SprecherSchritt sprecher;
  if (a.showNoVideoGesetzt) {
    s.showNoVideo = a.showNoVideo;
    // Neue SprecherWahl mit der neuen Einstellung, aus der Erinnerung vorbelegt (6.8).
    if (s.mode.load() == SlotMode::Speaker) {
      s.wahl = neueWahl(s);
      sprecher = s.wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetztMs());
      // Die Wahl ist die Wahrheit ueber den Slot (Nachtrag N2a.6): zeigt sie unter der neuen Einstellung jemand
      // anderen - auch niemanden (Ziel 0, speakerNone) -, haengt der Slot um, wie nach speakerConfig.
      sprecherWechsel = s.wahl->ziel() != zielImLauf(abo);   // F1: gegen das gewuenschte Ziel
    }
  }
  if (a.audioGesetzt || a.shareAudioGesetzt) {
    const SlotAudio audio = a.audioGesetzt ? a.audio : s.audio.load();
    const bool share = a.shareAudioGesetzt ? a.shareAudio : s.shareAudio.load();
    // F4: mit dem gewuenschten Ziel (eine anstehende Wiederholung zaehlt), wie in slotOn.
    UmhaengLage l = lageFuer(s, s.mode.load(), zielImLauf(abo), Grund::command);
    l.modusVorher = l.modusNachher;
    // 6.13, W6, N9-1: audioEnsureSubscribed() genau dann, wenn nach dem Einsetzen der gespeicherten Felder Ton an ist.
    const TonAenderung aenderung{a.audioGesetzt, a.audio, a.shareAudioGesetzt, a.shareAudio};
    const AboErgebnis aboErg = tonAboNoetig(l, aenderung) ? (audioEnsureSubscribed(s.nr) ? AboErgebnis::Geglueckt : AboErgebnis::Gescheitert)
                                                          : AboErgebnis::NichtGerufen;
    const UmhaengPlan tp = tonUmschaltPlan(l, aenderung, aboErg);
    s.audio = audio;
    s.shareAudio = share;
    s.tonAudioUnavailable = aboErg == AboErgebnis::Gescheitert;
    UmhaengLauf lauf;
    lauf.lage = l;
    lauf.ziel = zielImLauf(abo);
    lauf.tonMitmelden = false;
    planAusfuehren(s, lauf, tp);   // TonStandNeu, MischerNeu; TonMelden setzt configured
    for (const TonMeldung& m : tp.tonFolge) tonMelden(s, m.zustand, m.grund);   // E-a2-7: jede Meldung in Reihenfolge
  }
  const SlotMode vorher = s.mode.load();
  if (a.modeGesetzt && a.mode != vorher) {
    // Neues Ziel nach dem neuen Modus (6.10 Moduswechsel): Teilnehmer id aus demselben
    // Befehl, Sprecher Kandidat aus der Erinnerung, Freigabe die gezeigte, sonst 0.
    const unsigned ziel = zielNachModus(s, a.mode, a.idGesetzt ? a.id : 0, jetztMs());
    if (a.resGesetzt) s.res = a.res;
    slotRetarget(s, a.mode, ziel, Grund::modeChanged);
    return;
  }
  // F1: verglichen wird mit dem gewuenschten Ziel - steht nach 18 eine Wiederholung auf B an, haengt {id:A} um.
  if (a.idGesetzt && vorher == SlotMode::Participant && a.id != zielImLauf(abo)) {
    if (a.resGesetzt) s.res = a.res;
    slotRetarget(s, vorher, teilnehmerZiel(s.nr, a.id), Grund::targetChanged);
    return;
  }
  if (sprecherWechsel) {
    // N2a.6 (6.8, 6.2): Ziel und Grund der neuen Wahl (speakerChanged, bei Ziel 0 speakerNone); eine neue Aufloesung
    // aus demselben Befehl geht mit - hoechstens EIN Umhaengen.
    if (a.resGesetzt) s.res = a.res;
    slotRetarget(s, SlotMode::Speaker, s.wahl->ziel(), sprecher.grund);
    return;
  }
  if (a.resGesetzt && a.res != s.res) {
    s.res = a.res;
    slotRetarget(s, vorher, zielImLauf(abo), Grund::resolutionChanged);   // F1: das gewuenschte Ziel
    return;
  }
  // Kein Umhaengen: Bestaetigung mit Grund command (6.2).
  slotBestaetigen(s);
}

void slotOff(int nr, Grund grund) {
  if (!slotLaeuft(nr)) { emitSlotFehler("slotNotOn", nr); return; }
  abbauAusfuehren(Kette::SlotOff, grund, false, nr);
}

void slotsParticipantLeft(unsigned id) {
  if (id == 0) return;
  const int64_t jetzt = jetztMs();
  // Die Erinnerung verliert die Kennung, die Freigaben der Person gehen (6.8, 6.9, AN9).
  g_erinnerung.entferne(id);
  if (g_freigaben.weggang(id)) emitShares(nullptr);
  for (auto& [nr, s] : g_slots) {
    const SlotMode m = s->mode.load();
    // F1: der Weggang trifft das gewuenschte Ziel (waehrend einer 18-Wartezeit das der Wiederholung).
    if (m == SlotMode::Participant && zielImLauf(s->abo()) == id) {
      slotRetarget(*s, SlotMode::Participant, 0, Grund::participantLeft);
    } else if (m == SlotMode::Speaker && s->wahl) {
      // Der gezeigte Sprecher geht: Ziel 0 (speakerNone), der naechste Kandidat sofort (6.8 Nr. 6).
      const SprecherSchritt st = s->wahl->weggang(id, jetzt);
      if (!st.wechsel) continue;
      slotRetarget(*s, SlotMode::Speaker, 0, Grund::speakerNone);
      const SprecherSchritt naechster = s->wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetzt);
      if (naechster.wechsel) slotRetarget(*s, SlotMode::Speaker, naechster.ziel, naechster.grund);
    }
  }
}

void slotsKamera(unsigned id, int videoStatus) {
  // videoStatus-Ereignis (0.18): Video_ON = 0, Video_OFF = 1, Video_Mute_ByHost = 2.
  emitRaw("{\"ev\":\"videoStatus\",\"id\":" + std::to_string(id) + ",\"videoOn\":" + (videoStatus == Video_ON ? "true" : "false") +
          ",\"mutedByHost\":" + (videoStatus == Video_Mute_ByHost ? "true" : "false") + "}");
  for (auto& [nr, s] : g_slots) {
    if (s->mode.load() != SlotMode::Share && s->abo().target.load() == id) s->kameraAus = videoStatus != Video_ON;
  }
}

void slotsFreigabe(const MerkerFreigabe& f) {
  g_freigabeRecent.push_back(FreigabeRueckruf{jetztMs(), f.typNachtrag, f.status, f.user, f.share, f.contentType});
  while (g_freigabeRecent.size() > 10) g_freigabeRecent.pop_front();
  if (f.typNachtrag) {
    g_freigaben.typNachtrag(f.user, f.share, f.contentType);
  } else if (!g_freigaben.status(f.status, f.user, f.share, f.contentType) &&
             (f.status <= Sharing_Self_Send_Pure_Audio_End || f.status == Sharing_View_Other_Sharing)) {
    emitLog(L"Freigabe-Rueckruf ohne Wirkung (eigene Freigabe oder Ansicht), Status " + std::to_wstring(f.status));
  }
  // Jeder Freigabe-Rueckruf meldet shares (6.3); den Wechsel der gezeigten Freigabe
  // fuehrt slotLogicTick aus.
  emitShares(nullptr);
}

void slotsSprecher(const MerkerSprecher& m) {
  const int64_t jetzt = jetztMs();
  std::string ids;
  for (unsigned id : m.ids) ids += (ids.empty() ? "" : ",") + std::to_string(id);
  // Jedes der drei Signale geht an Connect, unabhaengig vom gewaehlten (6.8 Nr. 1). ANNAHME AN17 (unbelegt, MS22): die drei Sprecher-Signale kommen auch ohne JoinVoip (ohne Ton-Slot tritt die Bridge nicht bei).
  // ms aus der Bridge-Uhr jetztMs() (GetTickCount64), derselben wie shares.recent[].ms (Abschluss-Fix F10, M4) - bis
  // dahin QPC aus dem Rueckruf, eine zweite Uhr mit anderer Aufloesung neben der ersten in Connects Messwerten.
  emitRaw(std::string("{\"ev\":\"speakerSignal\",\"signal\":\"") + nameVon(SIGNAL_NAMEN, m.signal) + "\",\"ids\":[" + ids +
          "],\"ms\":" + std::to_string(jetzt) + "}");
  const Signal sig = static_cast<Signal>(m.signal);
  g_erinnerung.melde(sig, m.ids, jetzt);
  for (auto& [nr, s] : g_slots) {
    if (s->mode.load() != SlotMode::Speaker) continue;
    if (!s->wahl) s->wahl = neueWahl(*s);
    const SprecherSchritt st = s->wahl->signal(sig, m.ids, kameraAbfrage(), jetzt);
    if (st.wechsel) slotRetarget(*s, SlotMode::Speaker, st.ziel, st.grund);
  }
}

void slotsInMeeting() {
  // Kennungen wechseln nach einer Wiederverbindung (6.5): Sperre loesen, Halteliste
  // abbauen, eigene Kennung neu, Erinnerung und Freigaben leeren und neu befuellen, dann
  // jeden Slot neu zuordnen - die Reihenfolge gibt abbauPlan (6.15, PB20).
  abbauAusfuehren(Kette::InMeetingErneut, Grund::command);
}

void slotsMeetingNeu() { ++g_meetingNr; }

void bridgeStatsTick(bool initGelaufen) {
  if (!initGelaufen) return;
  const int64_t jetzt = jetztMs();
  static int64_t s_beginn = 0;
  static uint64_t s_prozess = 0, s_belegt = 0, s_gesamt = 0;
  FILETIME c, e, k, u, idle, kern, user;
  GetProcessTimes(GetCurrentProcess(), &c, &e, &k, &u);
  GetSystemTimes(&idle, &kern, &user);
  const auto wert = [](const FILETIME& f) { return (static_cast<uint64_t>(f.dwHighDateTime) << 32) | f.dwLowDateTime; };
  const uint64_t prozess = wert(k) + wert(u);
  const uint64_t gesamt = wert(kern) + wert(user);   // kern enthaelt idle
  const uint64_t belegt = gesamt - wert(idle);
  if (s_beginn == 0) {
    // Erstes Fenster: nur die Ausgangswerte; gemeldet wird erst mit einer Spanne.
    s_beginn = jetzt;
    s_prozess = prozess;
    s_belegt = belegt;
    s_gesamt = gesamt;
    return;
  }
  if (jetzt - s_beginn < 2000) return;
  const double spanneMs = static_cast<double>(jetzt - s_beginn);
  // 100-ns-Einheiten: 10 000 je Millisekunde. 100 % = ein Kern bzw. alle Kerne (6.3).
  const double cpu = static_cast<double>(prozess - s_prozess) / (spanneMs * 10000.0) * 100.0;
  const double sys = gesamt > s_gesamt ? static_cast<double>(belegt - s_belegt) * 100.0 / static_cast<double>(gesamt - s_gesamt) : 0.0;
  s_beginn = jetzt;
  s_prozess = prozess;
  s_belegt = belegt;
  s_gesamt = gesamt;
  PROCESS_MEMORY_COUNTERS speicher = {};
  const bool memDa = GetProcessMemoryInfo(GetCurrentProcess(), &speicher, sizeof(speicher)) != 0;
  const AudioZaehler a = audioZaehler();
  std::string out = "{\"ev\":\"bridgeStats\"";
  auto pflicht = [&](const char* name, const std::string& v) { out += std::string(",\"") + name + "\":" + v; };
  auto wenn = [&](bool gemessen, const char* name, const std::string& v) { if (gemessen) pflicht(name, v); };
  auto zahl1 = [](double d) { return std::to_string(static_cast<long long>(d * 10.0 + 0.5) / 10) + "." + std::to_string(static_cast<long long>(d * 10.0 + 0.5) % 10); };
  pflicht("cpuPct", zahl1(cpu));
  pflicht("sysPct", zahl1(sys));
  pflicht("memMb", std::to_string(memDa ? speicher.WorkingSetSize / (1024 * 1024) : 0));
  pflicht("audioQueueMax", std::to_string(a.queueMax));
  pflicht("audioDropped", std::to_string(a.dropped));
  pflicht("merkerVerworfen", std::to_string(merkerVerworfen()));
  pflicht("halteliste", std::to_string(g_slotsHalt.size()));
  pflicht("shareAudioPackets", std::to_string(a.shareAudioPackets));
  pflicht("shareAudioUnassigned", std::to_string(a.shareAudioUnassigned));
  wenn(a.shareAudioLastIdDa, "shareAudioLastId", std::to_string(a.shareAudioLastId));
  // Erst messen, dann bauen (Nachtrag N2b.4, Task-16-Review I1): in EINEM wenn(...)-Aufruf ist die Reihenfolge der
  // Argumente unbestimmt (MSVC meist rechts nach links) - der Wert entstuende vor der Messung (erfundene Werte, 6.3).
  // Video und Freigabe je mit eigenen Variablen.
  bool hd = false, original = false;
  const bool hdDa = sessionHdVideo(&hd);
  const bool originalDa = sessionOriginalSize(&original);
  wenn(hdDa, "hdVideo", hd ? "true" : "false");
  wenn(originalDa, "originalSize", original ? "true" : "false");
  int vw = 0, vh = 0, vfps = 0, sw = 0, sh = 0, sfps = 0;
  const bool videoDa = sessionEmpfangsStatistik(false, &vw, &vh, &vfps);
  const bool freigabeDa = sessionEmpfangsStatistik(true, &sw, &sh, &sfps);
  wenn(videoDa, "recvVideo",
       "{\"w\":" + std::to_string(vw) + ",\"h\":" + std::to_string(vh) + ",\"fps\":" + std::to_string(vfps) + "}");
  wenn(freigabeDa, "recvShare",
       "{\"w\":" + std::to_string(sw) + ",\"h\":" + std::to_string(sh) + ",\"fps\":" + std::to_string(sfps) + "}");
  pflicht("previewOn", vorschauAn() ? "true" : "false");
  emitRaw(out + "}");
}

bool rendererSperre() { return callbacksRendererSperre(); }

void slotsLeave() {
  // Zwei Plaene (6.15, Fuenfte Runde N8): bis einschliesslich sessionLeave(), dann der
  // Nachlauf mit dessen Rueckgabe (true: Halteliste verwerfen, false: sie bleibt).
  abbauAusfuehren(Kette::Leave, Grund::command);
  abbauAusfuehren(Kette::LeaveNachlauf, Grund::command, g_sessionLeaveErgebnis);
}

void slotsSprecherEinstellung(Signal signal, int64_t holdMs) {
  g_sprecher.signal = signal;
  g_sprecher.haltezeitMs = holdMs;
  const int64_t jetzt = jetztMs();
  // Gilt fuer alle Sprecher-Slots sofort (6.2); jede neue Wahl aus der Erinnerung vorbelegt.
  for (auto& [nr, s] : g_slots) {
    if (s->mode.load() != SlotMode::Speaker) continue;
    s->wahl = neueWahl(*s);
    s->wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetzt);
    // F1: gegen das gewuenschte Ziel - eine anstehende Wiederholung auf denselben Sprecher laeuft weiter.
    if (s->wahl->ziel() != zielImLauf(s->abo())) slotRetarget(*s, SlotMode::Speaker, s->wahl->ziel(), Grund::speakerChanged);
  }
  // Bestaetigung aus dem GESPEICHERTEN Zustand (Nachbesserung a3, NB-a3-3): command-probe vergleicht
  // sie mit dem Gesendeten - eine verlorene Haltezeit oder ein vertauschtes Signal faellt so ohne
  // Meeting auf.
  emitRaw(std::string("{\"ev\":\"speakerConfig\",\"signal\":\"") + nameVon(SIGNAL_NAMEN, g_sprecher.signal) + "\",\"holdMs\":" +
          std::to_string(g_sprecher.haltezeitMs) + "}");
}

void slotLogicTick(int64_t jetzt) {
  // Schritt 5 der Hauptschleife (6.6): Haltezeiten, Wechsel der gezeigten Freigabe,
  // Wiederholungen nach 18/29, vorgemerkte Umhaengungen. Waehrend der Renderer-Sperre
  // merkt slotRetarget nur vor.
  for (auto& [nr, s] : g_slots) {
    if (s->mode.load() != SlotMode::Speaker || !s->wahl) continue;
    const SprecherSchritt st = s->wahl->tick(kameraAbfrage(), jetzt);
    if (st.wechsel) slotRetarget(*s, SlotMode::Speaker, st.ziel, st.grund);
  }
  freigabeFolgen();
  wiederholungen(jetzt);
  if (rendererSperre()) return;
  for (auto& [nr, s] : g_slots) {
    if (s->vorgemerkt) slotRetarget(*s, s->vorgemerktMode, s->vorgemerktZiel, s->vorgemerktGrund);
  }
}

// quit/EOF: Ton ab, Vorschau-Thread beenden, Slots ab (6.15; der Plan legt die
// Reihenfolge fest, die Halteliste bleibt dann bis zum Prozessende stehen).
void slotsShutdownAll() { abbauAusfuehren(Kette::QuitEof, Grund::command); }

// Die Aufnahme-Erlaubnis ist ENTZOGEN (Stage 4b, N4b.1): Meeting lebt, Renderer gueltig;
// Freigaben und Sprecher-Erinnerung bleiben (Nachfix W3). Nie aus einem Rueckruf.
void slotsPrivilegeRevoked() { abbauAusfuehren(Kette::Entzug, Grund::privilegeRevoked); }

// Meeting zu Ende: OHNE Renderer-Aufruf (gemessener Absturz, README Abschnitt 8);
// die Halteliste wird ebenso ohne Renderer-Aufruf verworfen.
void slotsMeetingEnded() { abbauAusfuehren(Kette::MeetingEnde, Grund::meetingEnded); }

// LAEUFT AUF DEM HAUPTTHREAD (main.cpp, nach den Merkern). Liest g_slots ohne
// Kartensperre: alle Mutationen laufen auf diesem Thread.
void slotsTick() {
  const int64_t jetzt = jetztMs();
  unsigned int verworfen = 0;
  if (audioTakeOverflowReport(&verworfen)) {
    emitRaw(std::string("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioQueueOverflow\",\"dropped\":") +
            std::to_string(verworfen) + "}");
  }
  const std::vector<TonSlotSicht> sicht = tonSicht();
  AudioPacket p;
  while (audioPop(&p)) {
    const PaketArt art = p.kind == AudioArt::Mix ? PaketArt::Mix : p.kind == AudioArt::Share ? PaketArt::Share : PaketArt::Person;
    const std::vector<TonZiel> ziele = tonZiele(art, p.userId, sicht);
    if (art == PaketArt::Share && ziele.empty()) audioShareNichtZugeordnet();   // bridgeStats (B39)
    for (const TonZiel& z : ziele) {
      auto it = g_slots.find(z.nr);
      if (it == g_slots.end() || it->second->imAbbau.load()) continue;
      if (z.weg == Weg::Direkt) paketSenden(*it->second, p, jetzt);
      else mischerEinspeisen(*it->second, p, z.weg, jetzt);
    }
  }
  for (auto& [nr, s] : g_slots) mischerAusgeben(*s, jetzt);
  for (auto& [nr, s] : g_slots) {
    // Bild-Versatz: wartende Bilder ausgeben (Nachlauf), ohne Bedingung.
    s->sender.pump();
    versatzZaehlerMelden(*s, jetzt);
    stilleSenden(*s, jetzt);
    tonQuelleMessen(*s, jetzt);
    ersatzbildTick(*s, jetzt);
    slotStatsMelden(*s, jetzt);
  }
}

// --- Delegate (SDK-Thread) -----------------------------------------------------------

namespace {

void Slot::bildAnkunft(Abo& abo, YUVRawDataI420* data) {
  // Generation und Ziel VOR dem Riegel (Nachtrag N2a.1): haengt die Hauptschleife um, nachdem dieses Bild den Riegel
  // passiert hat, erkennt der Sperr-Block unten es an der Generation. Reihenfolge Generation, dann Ziel: ZielStandNeu
  // schreibt das Ziel vor der Generation.
  const uint64_t aboGen = abo.umhaengGeneration.load();
  const unsigned aboZiel = abo.target.load();
  // Riegel (6.10): ohne subscribed oder waehrend des Umhaengens verworfen.
  if (imAbbau.load() || riegelVerwirft(abo.subscribed.load(), abo.umhaengen.load())) {
    lateFrames.fetch_add(1);
    return;
  }
  const long long t0 = qpcJetzt();
  const int w = static_cast<int>(data->GetStreamWidth());
  const int h = static_cast<int>(data->GetStreamHeight());
  const uint8_t* buf = reinterpret_cast<const uint8_t*>(data->GetBuffer());
  // DER PUFFER WIRD GEPRUEFT, NICHT GEGLAUBT (wie bisher): NDI erwartet die drei
  // Ebenen zusammenhaengend. Einmal je Ziel gemeldet (slotBufferMismatch, 6.4).
  const size_t erwartet = static_cast<size_t>(w) * h * 3 / 2;
  if (!buf || w <= 0 || h <= 0 || data->GetBufferLen() != erwartet) {
    bool melden = false;
    bool verworfen = false;
    {
      std::lock_guard<std::mutex> lock(fieldMutex);
      // Fixrunde 1, F2: dieselbe Pruefung wie unten - ein spaetes, falsch geformtes Bild des alten Ziels markiert den
      // neuen Ziel-Stand nicht als gemeldet (slotBufferMismatch einmal je Ziel, 6.4).
      if (imAbbau.load() || riegelVerwirft(abo.subscribed.load(), abo.umhaengen.load()) ||
          abo.umhaengGeneration.load() != aboGen) {
        verworfen = true;
      } else {
        bufferMismatch = true;
        if (!abo.ziel.mismatchGemeldet) { abo.ziel.mismatchGemeldet = true; melden = true; }
      }
    }
    if (verworfen) { lateFrames.fetch_add(1); return; }
    if (melden) emitSlotFehler("slotBufferMismatch", nr);
    return;
  }
  const int64_t jetzt = jetztMs();
  const unsigned rot = data->GetRotation();
  const bool limited = data->IsLimitedI420();
  // GetSourceID(): Bedeutung bei VIDEO UND bei SHARE unbelegt (ANNAHME MS4; der Header
  // sagt nur "source_id of the current YUV raw data", zoom_sdk_raw_data_def.h:227-231).
  // Erwartet: Teilnehmer- bzw. Freigabe-Kennung. Ein abweichendes Bild zaehlt in
  // foreignFrames und geht hinaus (FP5); es beendet nur die Luecke nicht.
  const unsigned quelle = data->GetSourceID();
  const bool passt = quelle == aboZiel;
  if (!passt) foreignFrames.fetch_add(1);
  sender.sendI420(buf, w, h);
  // Kopie nur bei Freeze oder Freigabe (E9), per try_lock: haelt der Herzschlag die
  // Kopie gerade zum Senden, faellt diese eine aus.
  bool kopiert = false;
  if (mode.load() == SlotMode::Share || fallback.load() == Fallback::Freeze) {
    const long long k0 = qpcJetzt();
    if (last.m.try_lock()) {
      // Nur ein Bild DIESER Generation (N2a.1, B53): nach einem Umhaengen ueberschreibt ein spaetes Bild des alten
      // Ziels die Kopie des neuen nicht mehr.
      if (abo.umhaengGeneration.load() == aboGen) {
        last.i420.assign(buf, buf + erwartet);
        last.w = w;
        last.h = h;
        kopiert = true;
      }
      last.m.unlock();
    }
    copyUs.fetch_add(qpcUs(k0, qpcJetzt()));
  }
  frameCount.fetch_add(1);
  bool melden = false;
  bool spaet = false;
  {
    std::lock_guard<std::mutex> lock(fieldMutex);
    // ZWEITE Abfrage des Riegels, in DERSELBEN Sperre wie die Schreibzugriffe (N2a.1, I3 aus Stage 4): zwischen der
    // ersten oben und hier liegen Senden und Kopie. Hing die Hauptschleife inzwischen um (Generation anders) oder
    // steht sie mitten darin (Riegel), gehoert dieses Bild nicht zum Ziel-Stand: kein bildAnnehmen, keine gueltige
    // Kopie, kein Zustand, keine Vorschau.
    if (imAbbau.load() || riegelVerwirft(abo.subscribed.load(), abo.umhaengen.load()) ||
        abo.umhaengGeneration.load() != aboGen) {
      spaet = true;
    } else {
      ZielStand& z = abo.ziel;
      // 6.10 „Erstes Bild danach“ (PB23): bildSeitUmhaengen und live/frames am ERSTEN Bild,
      // das den Riegel passiert hat - ueber bildAnnehmen() aus slot_logic.h, nie an
      // GetSourceID() gebunden (Nachbesserung a3). bildAnnehmen fuehrt auch lastFrameMs,
      // lastW und lastH nach.
      if (bildAnnehmen(z, w, h, jetzt)) gapErstesBildMs = jetzt;
      // Getrennt davon die Luecke (gapMs, MS13): sie endet am ersten PASSENDEN Bild; kam 2 s
      // lang keins, am ersten Bild nach Schritt 6, mit gapUngeprueft (6.10, B10 c).
      if (gapOffen && (passt || jetzt - z.retargetMs >= 2000)) {
        gapMs = (passt ? jetzt : gapErstesBildMs) - z.retargetMs;
        gapUngeprueft = !passt;
        gapOffen = false;
      }
      if (kopiert) z.kopieGueltig = true;
      bufferMismatch = false;
      if (!z.gemessen || rotation != rot || limitedRange != limited || state != SlotState::Live || grund != Grund::frames ||
          sent != Sent::None) {
        z.gemessen = true;
        rotation = rot;
        limitedRange = limited;
        state = SlotState::Live;
        grund = Grund::frames;
        sent = Sent::None;
        melden = true;
      }
    }
  }
  if (spaet) { lateFrames.fetch_add(1); return; }
  workUs.fetch_add(qpcUs(t0, qpcJetzt()));
  // Vorschau nur aus echten Bildern (E16), eigene Kosten in previewUs; mit dem Ziel, das vor dem Riegel galt
  // (N2a.1): ein Umhaengen zwischen Sperr-Block und hier beschriftet das Bild nicht mit dem neuen Ziel.
  vorschauBild(nr, aboZiel, buf, w, h, jetzt);
  if (melden) emitSlot(*this);
}

void Delegate::onRendererBeDestroyed() {
  // ZUERST in den Flug (F15), darin abgemeldet (F1, I-1): ist der Delegate ausgemustert (Renderer verworfen, abgebaut,
  // Slot geloescht), fasst der Rueckruf weder Slot noch Abo an - beide koennen frei sein. Laeuft er, wartet der
  // Hauptthread mit dem Freigeben, bis er den Waechter am Ende verlaesst.
  const RueckrufImFlug flug(wache);
  // Merker fuer die Abnahme (Gruppe L): wann der Rueckruf kommt - vor oder nach destroyRenderer, vor oder nach ENDED.
  // Nur die Slot-Nummer des Delegates (nie ein Name). emitLog ist eine einzige CRT-Schreibung mit eigener Stream-Sperre;
  // so schreiben auch die Lauscher-Rueckrufe (callbacks.cpp), und bildAnkunft schreibt aus diesem Delegate stdout.
  emitLog(L"Slot " + std::to_wstring(nr_) +
          (flug.drin() ? L": onRendererBeDestroyed" : L": onRendererBeDestroyed nach dem Abmelden (nichts angefasst)"));
  if (!flug.drin()) return;
  // "you should never use this renderer object any more"
  // (rawdata_renderer_interface.h:36-40): nur das Atom, den Rest macht die
  // Hauptschleife beim naechsten Umhaengen (6.10 Schritt 2).
  if (!abo_->rendererTot.exchange(true)) slot_->rendererLost.fetch_add(1);
}

void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  const RueckrufImFlug flug(wache);   // F15: zaehlen, dann pruefen - bis zum Ende dieses Rumpfs im Flug
  if (!flug.drin() || data == nullptr) return;   // F1: ein abgemeldeter Delegate fasst nichts an
  slot_->bildAnkunft(*abo_, data);
}

void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  const RueckrufImFlug flug(wache);   // F15: zaehlen, dann pruefen - bis zum Ende dieses Rumpfs im Flug
  if (!flug.drin()) return;   // F1: ein abgemeldeter Delegate fasst nichts an
  // RawData_Off setzt KEINEN Grund (6.7): der Header dokumentiert ihn nicht, und er
  // kam gemessen auch nach unSubscribe(). Nach dem ersten Bild dieses Ziels loest er
  // nur die Abfrage IsVideoOn() in der Hauptschleife aus. Der Riegel verwirft ihn, auch wenn er erst nach der Rueckkehr von unSubscribe kommt (ANNAHME AN22, unbelegt).
  const uint64_t aboGen = abo_->umhaengGeneration.load();   // vor dem Riegel (Nachtrag N2a.1)
  if (slot_->imAbbau.load() || riegelVerwirft(abo_->subscribed.load(), abo_->umhaengen.load())) return;
  if (status != RawData_Off) return;
  std::lock_guard<std::mutex> lock(slot_->fieldMutex);
  // Riegel und Generation noch einmal unter der Sperre (N2a.1): ein Umhaengen dazwischen verwirft die Meldung.
  if (slot_->imAbbau.load() || riegelVerwirft(abo_->subscribed.load(), abo_->umhaengen.load()) ||
      abo_->umhaengGeneration.load() != aboGen) {
    return;
  }
  if (abo_->ziel.bildSeitUmhaengen) abo_->ziel.rawOffGesehen = true;
}

}  // namespace
