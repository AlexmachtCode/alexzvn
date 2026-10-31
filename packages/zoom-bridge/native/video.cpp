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
#include "session.h"
#include "callbacks.h"
#include "audio.h"
#include "preview.h"

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
// Auf welchem Thread das SDK die Delegate-Rueckrufe ruft, sagt kein Header (heute nur
// Kommentar, E15); die Regel traegt beide Faelle.

struct Slot;
struct Abo;

class Delegate : public IZoomSDKRendererDelegate {
 public:
  Delegate(Slot* slot, Abo* abo) : slot_(slot), abo_(abo) {}
  void onRendererBeDestroyed() override;
  void onRawDataFrameReceived(YUVRawDataI420* data) override;
  void onRawDataStatusChanged(RawDataStatus status) override;

 private:
  Slot* slot_;
  Abo* abo_;
};

// Ein Abo = Renderer, Delegate, Ziel, Typ, Ziel-Stand (Spec 6.1). In 0.4.0 hat
// jeder laufende Slot GENAU EIN Abo; alle Wege (Umhaengen, Abbau, Messwerte)
// gehen trotzdem ueber Slot::abos, damit die Galerie (0.5.0) Abos hinzufuegen
// kann, ohne diese Wege umzubauen (Spec 15).
struct Abo {
  IZoomSDKRenderer* renderer = nullptr;
  std::unique_ptr<Delegate> delegate;
  // Delegates verworfener Renderer (rendererTot, 6.10 Schritt 2): nie freigegeben,
  // solange das Abo lebt - das SDK hat seinen Renderer abgebaut, ob es den
  // Delegate danach noch einmal ruft, sagt kein Header.
  std::vector<std::unique_ptr<Delegate>> alteDelegates;
  std::atomic<unsigned int> target{0};     // Teilnehmer-Kennung (VIDEO) oder shareSourceID (SHARE); 0 = keins
  ZoomSDKRawDataType type = RAW_DATA_TYPE_VIDEO;   // Typ des letzten subscribe() dieses Renderers
  std::atomic<bool> subscribed{false};    // true nur zwischen gegluecktem subscribe() und dem naechsten unSubscribe()
  std::atomic<bool> umhaengen{false};     // Riegel: true von vor unSubscribe() bis nach subscribe() (6.10)
  std::atomic<bool> rendererTot{false};   // onRendererBeDestroyed kam: Zeiger nie mehr anfassen (6.10, B32)
  ZielStand ziel;                         // unter fieldMutex des Slots
  // Wiederholung nach SDKERR_TOO_FREQUENT_CALL / SDKERR_NO_SHARE_DATA (6.10), nur Hauptthread.
  bool wiederholen = false;
  int versuch = 0;
  int64_t wiederholenAbMs = 0;
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
  // Kopie des letzten Bildes DIESES Ziels (Freeze, Freigabe; 6.12). Gueltig nur mit
  // abo.ziel.kopieGueltig.
  FrameCopy last;

  // --- nur Hauptthread ---
  int64_t letztesErsatzMs = 0;
  bool kameraAus = false;                  // Zoom meldet die Kamera des Ziels als aus (videoStatus, IsVideoOn)
  int resSet = -1, resGot = -1;            // 6.11; -1 = noch nicht gesetzt
  TonZustand tonZustand = TonZustand::Off;
  TonGrund tonGrund = TonGrund::command;
  TonQuelle tonConfigured = TonQuelle::None;
  TonQuelle tonSource = TonQuelle::None;   // gemessen, letztes 500-ms-Fenster (6.3)
  bool tonAudioUnavailable = false;        // audioEnsureSubscribed() scheiterte; bleibt bis Ton neu an (6.13)
  int64_t tonFensterBeginnMs = 0;
  bool tonFensterPerson = false;
  int64_t versatzMessBeginnMs = 0;
  // Vorgemerktes Umhaengen waehrend der Renderer-Sperre (6.10 Schritt 0).
  bool vorgemerkt = false;
  SlotMode vorgemerktMode = SlotMode::Participant;
  unsigned vorgemerktZiel = 0;
  Grund vorgemerktGrund = Grund::command;
  // Sprecher-Slot: die Wahl dieses Slots (6.8), neu bei Einschalten, Moduswechsel auf
  // Sprecher und Wechsel des Signals, je aus der Erinnerung vorbelegt.
  std::unique_ptr<SprecherWahl> wahl;

  Abo& abo() { return *abos.front(); }

  // Bildweg Delegate -> Slot -> Kopie, Vorschau, Sender (6.1, 0.30). Nie direkt
  // Delegate -> Sender: 0.5.0 setzt hier einen Zusammensetzer ein.
  void bildAnkunft(Abo& abo, YUVRawDataI420* data);
};

std::map<int, std::unique_ptr<Slot>> g_slots;   // hoechstens 16 Eintraege

// Sprecher und Freigaben (6.8, 6.9): EINE Erinnerung und EINE Liste je Bridge, nur
// Hauptthread. Gefuettert aus den Merkern (main.cpp, merkerNehmen).
SprecherErinnerung g_erinnerung;
SprecherEinstellung g_sprecher;                 // speakerConfig; Vorgabe speakerVideo, 1000 ms (E19)
FreigabeListe g_freigaben;
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

// slot-Ereignis (Spec 6.3). target = Teilnehmer-Kennung bzw. bei SHARE die teilende
// Person, share = Freigabe-Kennung (nur SHARE). rotation/limitedRange erst nach dem
// ersten Bild DIESES Ziels (Regel "keine erfundenen Werte", B55).
void emitSlot(Slot& s) {
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
  if (!s.abos.empty()) {
    const unsigned t = s.abo().target.load();
    if (mode == SlotMode::Share) { share = t; target = t != 0 ? s.shareUser.load() : 0; }
    else target = t;
  }
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

// slot off (Abbau): der Slot existiert danach nicht mehr, darum ohne Messfelder.
void emitSlotOff(Slot& s, Grund grund) {
  emitRaw("{\"ev\":\"slot\",\"slot\":" + std::to_string(s.nr) + ",\"state\":\"off\",\"mode\":\"" +
          nameVon(MODUS_NAMEN, s.mode.load()) + "\",\"target\":0,\"share\":0,\"reason\":\"" + nameVon(GRUND_NAMEN, grund) +
          "\",\"sent\":\"none\",\"ndi\":\"" + jsonEscapeUtf8(s.ndi) + "\"}");
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
bool kameraAn(unsigned id) {
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
// Typwechsel, 6.10) rufen sie. Liefert den SDKError; ohne Renderer nie SUCCESS. Zwei Slots auf dieselbe Kennung haben je einen eigenen Renderer, beide beliefert: ANNAHME AN21 (unbelegt, MS21).
SDKError rendererAnlegen(Abo& abo) {
  abo.renderer = nullptr;
  SDKError err = createRenderer(&abo.renderer, abo.delegate.get());
  if (err == SDKERR_SUCCESS && abo.renderer == nullptr) err = SDKERR_UNINITIALIZE;
  if (err != SDKERR_SUCCESS) {
    abo.renderer = nullptr;
    return err;
  }
  abo.rendererTot = false;
  return SDKERR_SUCCESS;
}

void subscribeAusfuehren(Slot& s, UmhaengLauf& lauf) {
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
  const UmhaengPlan weiter = umhaengNachSubscribe(lauf.lage, static_cast<int>(err), abo.versuch);
  planAusfuehren(s, lauf, weiter);
  // Fehler nach einem Typwechsel ist ein Fall fuer den gleichen Delegate: der Plan
  // ruft dann DestroyRenderer, CreateRendererGleicherDelegate und Subscribe erneut.
  if (err != SDKERR_SUCCESS && !abo.wiederholen) abo.type = typ;
}

void planAusfuehren(Slot& s, UmhaengLauf& lauf, const UmhaengPlan& plan) {
  Abo& abo = s.abo();
  size_t tonNr = 0;   // naechste Meldung aus plan.tonFolge (E-a2-7)
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
        // Nie destroyRenderer, nie ein anderer Aufruf: das SDK hat ihn abgebaut (B32).
        abo.renderer = nullptr;
        abo.subscribed = false;
        if (abo.delegate) abo.alteDelegates.push_back(std::move(abo.delegate));
        break;
      case UmhaengSchritt::CreateRendererNeuerDelegate: {
        abo.delegate = std::make_unique<Delegate>(&s, &abo);
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
        if (abo.renderer != nullptr && !abo.rendererTot.load()) logSdkError(L"destroyRenderer() beim Typwechsel", destroyRenderer(abo.renderer));
        abo.renderer = nullptr;
        break;
      case UmhaengSchritt::CreateRendererGleicherDelegate: {
        // Typwechsel nach gescheitertem subscribe (6.10, AN11: ob destroyRenderer
        // synchron abschliesst, sagt kein Header - der gleiche Delegate bleibt).
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
        break;
      case UmhaengSchritt::Subscribe:
        subscribeAusfuehren(s, lauf);
        return;   // der Rest steht im Plan nach subscribe (umhaengNachSubscribe)
      case UmhaengSchritt::WiederholenIn500ms:
        abo.wiederholen = true;
        ++abo.versuch;
        abo.wiederholenAbMs = jetztMs() + 500;
        break;
      case UmhaengSchritt::ZielStandNeu: {
        std::lock_guard<std::mutex> lock(s.fieldMutex);
        abo.ziel = ZielStand{};
        abo.ziel.retargetMs = jetztMs();
        s.bufferMismatch = false;
        s.gapUngeprueft = false;
        abo.target = lauf.ziel;
        s.kameraAus = false;
        s.gapOffen = true;           // die Luecke beginnt neu (6.10, Nachbesserung a3)
        s.gapErstesBildMs = 0;
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
        std::lock_guard<std::mutex> lock(s.fieldMutex);
        s.ton = TonStand{};
        break;
      }
      case UmhaengSchritt::MischerEingangBNeu:
      case UmhaengSchritt::MischerNeu:
        break;   // Mischer kommt mit A15
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
  l.sperre = callbacksRendererSperre();
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
    s.mode = nachher;
  }
  planAusfuehren(s, lauf, plan);
  if (nurVormerken) return;
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
    if (!erst) out += ",";
    erst = false;
    out += "{\"ms\":" + std::to_string(r.ms) + ",\"cb\":\"" + (r.inhalt ? "shareContent" : "sharingStatus") + "\",\"status\":\"" +
           nameVon(SHARING_STATUS_NAMEN, r.status) + "\",\"user\":" + std::to_string(r.user) + ",\"share\":" + std::to_string(r.share) +
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

bool andererFreigabeSlot(const Slot& ohne) {
  for (const auto& [nr, s] : g_slots) {
    if (s.get() != &ohne && s->mode.load() == SlotMode::Share) return true;
  }
  return false;
}

// Ziel nach Modus (6.7-6.10): Teilnehmer die Kennung, Sprecher der Kandidat aus der
// Erinnerung (neue SprecherWahl, vorbelegt), Freigabe die gezeigte Freigabe (shareUser =
// teilende Person). Der erste Freigabe-Slot befuellt die Liste, nur ergaenzend (B38).
unsigned zielNachModus(Slot& s, SlotMode m, unsigned idTeilnehmer, int64_t jetzt) {
  if (m == SlotMode::Participant) return idTeilnehmer;
  if (m == SlotMode::Speaker) {
    s.wahl = neueWahl(s);
    s.wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetzt);
    return s.wahl->ziel();
  }
  if (!andererFreigabeSlot(s)) freigabenBefuellen(true);
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

// Wiederholung nach 18 bzw. 29 (6.10): dasselbe Ziel, dieselbe Lage, nur subscribe neu. Dass subscribe auf eine Freigabe sonst sofort Daten liefert, ist ANNAHME AN26 (unbelegt, MS27).
void wiederholungen(int64_t jetzt) {
  for (auto& [nr, s] : g_slots) {
    Abo& abo = s->abo();
    if (!abo.wiederholen || jetzt < abo.wiederholenAbMs || callbacksRendererSperre()) continue;
    abo.wiederholen = false;
    UmhaengLauf lauf;
    lauf.ziel = abo.target.load();
    lauf.lage = lageFuer(*s, s->mode.load(), lauf.ziel, Grund::command);
    lauf.lage.modusVorher = lauf.lage.modusNachher;
    abo.umhaengen = true;
    subscribeAusfuehren(*s, lauf);
    abo.subscribed = lauf.subscribeGeglueckt;
    abo.umhaengen = false;
  }
}

// --- Abbau (vorlaeufig, A-EP17): Ketten-Semantik von 0.3.0 --------------------------
// sdkAbmelden = true: Meeting lebt (leave/quit/EOF/Entzug/slotOff) - unSubscribe und
// destroyRenderer. false: Meeting ist zu Ende - Renderer NICHT anfassen (gemessener
// Absturz 0xC0000005, README Abschnitt 8). nurNr != 0: nur dieser Slot (slotOff).
// Jeder Slot meldet slotAudio off vor slot off (Ton vor Bild). Abbau-Marken auf stderr,
// damit ein Absturz die Zeile benennt (Lehre vom 18.08.2026).
void slotsAbbauAlle(Grund grund, bool sdkAbmelden, int nurNr = 0) {
  const char* grundText = nameVon(GRUND_NAMEN, grund);
  emitLog(L"Abbau beginnt (" + std::wstring(grundText, grundText + std::strlen(grundText)) + L"), SDK abmelden: " +
          (sdkAbmelden ? L"ja" : L"nein"));
  for (auto it = g_slots.begin(); it != g_slots.end();) {
    Slot& s = *it->second;
    if (nurNr != 0 && s.nr != nurNr) { ++it; continue; }
    s.imAbbau = true;
    TonGrund tg = TonGrund::command;
    if (grund == Grund::meetingEnded) tg = TonGrund::meetingEnded;
    if (grund == Grund::privilegeRevoked) tg = TonGrund::privilegeRevoked;
    tonMelden(s, TonZustand::Off, tg);
    emitSlotOff(s, grund);
    // Vorschau-Platz VOR dem Loeschen abmelden (6.16).
    vorschauAbmelden(s.nr);
    for (auto& abo : s.abos) {
      abo->subscribed = false;
      if (abo->renderer != nullptr && sdkAbmelden && !abo->rendererTot.load()) {
        emitLog(L"Abbau Slot " + std::to_wstring(s.nr) + L": unSubscribe()");
        logSdkError(L"unSubscribe() beim Abbau", abo->renderer->unSubscribe());
        emitLog(L"Abbau Slot " + std::to_wstring(s.nr) + L": destroyRenderer()");
        logSdkError(L"destroyRenderer() beim Abbau", destroyRenderer(abo->renderer));
      } else if (abo->renderer != nullptr) {
        emitLog(L"Abbau Slot " + std::to_wstring(s.nr) + L": Renderer nicht angefasst");
      }
      abo->renderer = nullptr;
    }
    s.sender.close();
    emitLog(L"Abbau Slot " + std::to_wstring(s.nr) + L": fertig");
    it = g_slots.erase(it);
  }
  emitLog(L"Abbau fertig");
}

// --- Ton-Zuordnung und Messung (Spec 6.13; Person-Ton ab A11, alle Arten ab A15) ----

std::vector<TonSlotSicht> tonSicht() {
  std::vector<TonSlotSicht> v;
  for (auto& [nr, s] : g_slots) {
    v.push_back(TonSlotSicht{nr, !s->imAbbau.load(), s->mode.load(), s->abo().target.load(), s->audio.load(),
                             s->shareAudio.load(), s->shareUser.load()});
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

// Ein Paket an einen Slot (Weg direkt). Prueft die Pufferlaenge je Paket; meldet eine
// falsche einmal je Ton-Stand (audioBufferMismatch mit slot, 6.4).
void paketSenden(Slot& s, const AudioPacket& p, int64_t jetzt) {
  if (p.sampleCount <= 0 || p.bufferLen % (sizeof(int16_t) * static_cast<unsigned int>(p.channels)) != 0) {
    bool melden = false;
    {
      std::lock_guard<std::mutex> lock(s.fieldMutex);
      if (!s.ton.audioMismatchGemeldet) { s.ton.audioMismatchGemeldet = true; melden = true; }
    }
    if (melden) {
      emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioBufferMismatch\",\"slot\":" + std::to_string(s.nr) + "}");
    }
    return;
  }
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
  s.tonFensterPerson = true;
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
  const TonQuelle q = s.tonFensterPerson ? TonQuelle::Person : TonQuelle::None;
  s.tonFensterBeginnMs = jetzt;
  s.tonFensterPerson = false;
  if (q != s.tonSource) {
    s.tonSource = q;
    emitSlotAudio(s);
  }
}

// Stille-Herzschlag je Slot (6.13): wie viel, entscheidet stilleBloecke().
void stilleSenden(Slot& s, int64_t jetzt) {
  const TonQuelle weg = tonWeg(s.mode.load(), s.audio.load(), s.shareAudio.load());
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
  // RawData_Off nach dem ersten Bild dieses Ziels: nur die Abfrage IsVideoOn() (6.7).
  if (z.rawOffGesehen) {
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
  lage.letztesErsatzMs = s.letztesErsatzMs;
  lage.jetzt = jetzt;
  BildEntscheidung e = bildEntscheidung(lage, z);
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
    if (e.sent == Sent::Held) s.heldFrames.fetch_add(1);
    else s.fallbackCount.fetch_add(1);
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
  if (callbacksRendererSperre()) { emitSlotFehler("slotReconnecting", b.nr); return; }
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
  abo.delegate = std::make_unique<Delegate>(&s, &abo);
  const SDKError err = rendererAnlegen(abo);
  if (err != SDKERR_SUCCESS) {
    logSdkError(L"createRenderer()", err);
    emitLog(std::wstring(L"createRenderer() lieferte keinen Renderer. HasRawdataLicense()=") +
            (HasRawdataLicense() ? L"true" : L"false"));
    s.sender.close();
    emitSlotFehler("slotRendererFailed", b.nr);
    return;
  }
  g_slots[b.nr] = std::move(slot);
  vorschauAnmelden(b.nr);
  // Erstes Ziel nach Modus (6.7-6.9): Teilnehmer die Kennung aus dem Befehl, Sprecher
  // aus der Sprecher-Erinnerung, Freigabe die gezeigte Freigabe.
  unsigned ziel = zielNachModus(s, b.mode, b.id, jetztMs());
  if (b.mode == SlotMode::Participant && ziel != 0 && !sessionFindParticipant(ziel, nullptr, nullptr)) {
    emitLog(L"Slot " + std::to_wstring(b.nr) + L": Kennung " + std::to_wstring(ziel) + L" gehoert keinem Teilnehmer - kein Ziel");
    ziel = 0;
  }
  slotRetargetIntern(s, b.mode, ziel, Grund::command, false);
  // Ton (6.13, W6, N9-1): audioEnsureSubscribed() genau dann, wenn tonAboNoetig(); den Plan gibt tonUmschaltPlan.
  UmhaengLage l = lageFuer(s, b.mode, abo.target.load(), Grund::command);
  l.modusVorher = b.mode;
  const TonAenderung aenderung{true, b.audio, true, b.shareAudio};
  const AboErgebnis aboErg = tonAboNoetig(l, aenderung) ? (audioEnsureSubscribed() ? AboErgebnis::Geglueckt : AboErgebnis::Gescheitert)
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
  // Reihenfolge (6.2): fallback, showNoVideo, Ton, dann hoechstens EIN Umhaengen.
  if (a.fallbackGesetzt) s.fallback = a.fallback;
  if (a.showNoVideoGesetzt) {
    s.showNoVideo = a.showNoVideo;
    // Neue SprecherWahl mit der neuen Einstellung, aus der Erinnerung vorbelegt (6.8).
    if (s.mode.load() == SlotMode::Speaker) {
      s.wahl = neueWahl(s);
      s.wahl->vorbelegen(g_erinnerung, kameraAbfrage(), jetztMs());
    }
  }
  if (a.audioGesetzt || a.shareAudioGesetzt) {
    const SlotAudio audio = a.audioGesetzt ? a.audio : s.audio.load();
    const bool share = a.shareAudioGesetzt ? a.shareAudio : s.shareAudio.load();
    UmhaengLage l = lageFuer(s, s.mode.load(), abo.target.load(), Grund::command);
    l.modusVorher = l.modusNachher;
    // 6.13, W6, N9-1: audioEnsureSubscribed() genau dann, wenn nach dem Einsetzen der gespeicherten Felder Ton an ist.
    const TonAenderung aenderung{a.audioGesetzt, a.audio, a.shareAudioGesetzt, a.shareAudio};
    const AboErgebnis aboErg = tonAboNoetig(l, aenderung) ? (audioEnsureSubscribed() ? AboErgebnis::Geglueckt : AboErgebnis::Gescheitert)
                                                          : AboErgebnis::NichtGerufen;
    const UmhaengPlan tp = tonUmschaltPlan(l, aenderung, aboErg);
    s.audio = audio;
    s.shareAudio = share;
    s.tonAudioUnavailable = aboErg == AboErgebnis::Gescheitert;
    UmhaengLauf lauf;
    lauf.lage = l;
    lauf.ziel = abo.target.load();
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
  if (a.idGesetzt && vorher == SlotMode::Participant && a.id != abo.target.load()) {
    if (a.resGesetzt) s.res = a.res;
    unsigned ziel = a.id;
    if (ziel != 0 && !sessionFindParticipant(ziel, nullptr, nullptr)) {
      emitLog(L"Slot " + std::to_wstring(s.nr) + L": Kennung " + std::to_wstring(ziel) + L" gehoert keinem Teilnehmer - kein Ziel");
      ziel = 0;
    }
    slotRetarget(s, vorher, ziel, Grund::targetChanged);
    return;
  }
  if (a.resGesetzt && a.res != s.res) {
    s.res = a.res;
    slotRetarget(s, vorher, abo.target.load(), Grund::resolutionChanged);
    return;
  }
  // Kein Umhaengen: Bestaetigung mit Grund command (6.2).
  {
    std::lock_guard<std::mutex> lock(s.fieldMutex);
    s.grund = Grund::command;
  }
  emitSlot(s);
}

void slotOff(int nr, Grund grund) {
  if (!slotLaeuft(nr)) { emitSlotFehler("slotNotOn", nr); return; }
  slotsAbbauAlle(grund, true, nr);
}

void slotsParticipantLeft(unsigned id) {
  if (id == 0) return;
  const int64_t jetzt = jetztMs();
  // Die Erinnerung verliert die Kennung, die Freigaben der Person gehen (6.8, 6.9, AN9).
  g_erinnerung.entferne(id);
  if (g_freigaben.weggang(id)) emitShares(nullptr);
  for (auto& [nr, s] : g_slots) {
    const SlotMode m = s->mode.load();
    if (m == SlotMode::Participant && s->abo().target.load() == id) {
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
  const long long f = qpcFrequenz();
  std::string ids;
  for (unsigned id : m.ids) ids += (ids.empty() ? "" : ",") + std::to_string(id);
  // Jedes der drei Signale geht an Connect, unabhaengig vom gewaehlten (6.8 Nr. 1). ANNAHME AN17 (unbelegt, MS22): die drei Sprecher-Signale kommen auch ohne JoinVoip (ohne Ton-Slot tritt die Bridge nicht bei).
  emitRaw(std::string("{\"ev\":\"speakerSignal\",\"signal\":\"") + nameVon(SIGNAL_NAMEN, m.signal) + "\",\"ids\":[" + ids +
          "],\"ms\":" + std::to_string(f > 0 ? m.qpc * 1000 / f : jetzt) + "}");
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
  // Kennungen wechseln nach einer Wiederverbindung (6.5): Erinnerung leeren, Freigaben
  // leeren und neu befuellen, dann jeden Slot neu zuordnen (6.15 "Zoom verbindet selbst
  // neu"): Teilnehmer Ziel 0 bis Connect neue Kennungen schickt, Sprecher Ziel 0 bis zum
  // naechsten Signal, Freigabe die gezeigte.
  g_erinnerung.leeren();
  g_freigaben.leeren();
  g_gezeigtShare = g_gezeigtUser = 0;
  freigabenBefuellen(false);
  const FreigabeEintrag* g = g_freigaben.gezeigt();
  g_gezeigtShare = g != nullptr ? g->share : 0;
  g_gezeigtUser = g != nullptr ? g->user : 0;
  for (auto& [nr, s] : g_slots) {
    const SlotMode m = s->mode.load();
    if (m == SlotMode::Participant) {
      slotRetarget(*s, m, 0, Grund::noTarget);
    } else if (m == SlotMode::Speaker) {
      s->wahl = neueWahl(*s);
      slotRetarget(*s, m, 0, Grund::speakerNone);
    } else {
      s->shareUser = g_gezeigtUser;
      slotRetarget(*s, m, g_gezeigtShare, g_gezeigtShare != 0 ? Grund::shareChanged : Grund::shareNone);
    }
  }
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
    if (s->wahl->ziel() != s->abo().target.load()) slotRetarget(*s, SlotMode::Speaker, s->wahl->ziel(), Grund::speakerChanged);
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
  if (callbacksRendererSperre()) return;
  for (auto& [nr, s] : g_slots) {
    if (s->vorgemerkt) slotRetarget(*s, s->vorgemerktMode, s->vorgemerktZiel, s->vorgemerktGrund);
  }
}

void slotsShutdownAll() { slotsAbbauAlle(Grund::command, true); }

// Die Aufnahme-Erlaubnis ist ENTZOGEN (Stage 4b, N4b.1): Meeting lebt, Renderer gueltig.
void slotsPrivilegeRevoked() {
  if (g_slots.empty()) return;
  slotsAbbauAlle(Grund::privilegeRevoked, true);
}

// Meeting zu Ende: OHNE SDK-Abmeldung (gemessener Absturz, README Abschnitt 8).
void slotsMeetingEnded() {
  if (g_slots.empty()) return;
  slotsAbbauAlle(Grund::meetingEnded, false);
}

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
    for (const TonZiel& z : tonZiele(PaketArt::Person, p.userId, sicht)) {
      auto it = g_slots.find(z.nr);
      if (it == g_slots.end() || it->second->imAbbau.load()) continue;
      paketSenden(*it->second, p, jetzt);
    }
  }
  for (auto& [nr, s] : g_slots) {
    // Bild-Versatz: wartende Bilder ausgeben (Nachlauf), ohne Bedingung.
    s->sender.pump();
    versatzZaehlerMelden(*s, jetzt);
    stilleSenden(*s, jetzt);
    tonQuelleMessen(*s, jetzt);
    ersatzbildTick(*s, jetzt);
  }
}

// --- Delegate (SDK-Thread) -----------------------------------------------------------

namespace {

void Slot::bildAnkunft(Abo& abo, YUVRawDataI420* data) {
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
    {
      std::lock_guard<std::mutex> lock(fieldMutex);
      bufferMismatch = true;
      if (!abo.ziel.mismatchGemeldet) { abo.ziel.mismatchGemeldet = true; melden = true; }
    }
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
  const bool passt = quelle == abo.target.load();
  if (!passt) foreignFrames.fetch_add(1);
  sender.sendI420(buf, w, h);
  // Kopie nur bei Freeze oder Freigabe (E9), per try_lock: haelt der Herzschlag die
  // Kopie gerade zum Senden, faellt diese eine aus.
  bool kopiert = false;
  if (mode.load() == SlotMode::Share || fallback.load() == Fallback::Freeze) {
    const long long k0 = qpcJetzt();
    if (last.m.try_lock()) {
      last.i420.assign(buf, buf + erwartet);
      last.w = w;
      last.h = h;
      last.m.unlock();
      kopiert = true;
    }
    copyUs.fetch_add(qpcUs(k0, qpcJetzt()));
  }
  frameCount.fetch_add(1);
  bool melden = false;
  {
    std::lock_guard<std::mutex> lock(fieldMutex);
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
  workUs.fetch_add(qpcUs(t0, qpcJetzt()));
  // Vorschau nur aus echten Bildern (E16), eigene Kosten in previewUs.
  vorschauBild(nr, abo.target.load(), buf, w, h, jetzt);
  if (melden) emitSlot(*this);
}

void Delegate::onRendererBeDestroyed() {
  // "you should never use this renderer object any more"
  // (rawdata_renderer_interface.h:36-40): nur das Atom, den Rest macht die
  // Hauptschleife beim naechsten Umhaengen (6.10 Schritt 2).
  if (!abo_->rendererTot.exchange(true)) slot_->rendererLost.fetch_add(1);
}

void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  if (data == nullptr) return;
  slot_->bildAnkunft(*abo_, data);
}

void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  // RawData_Off setzt KEINEN Grund (6.7): der Header dokumentiert ihn nicht, und er
  // kam gemessen auch nach unSubscribe(). Nach dem ersten Bild dieses Ziels loest er
  // nur die Abfrage IsVideoOn() in der Hauptschleife aus. Der Riegel verwirft ihn, auch wenn er erst nach der Rueckkehr von unSubscribe kommt (ANNAHME AN22, unbelegt).
  if (slot_->imAbbau.load() || riegelVerwirft(abo_->subscribed.load(), abo_->umhaengen.load())) return;
  if (status != RawData_Off) return;
  std::lock_guard<std::mutex> lock(slot_->fieldMutex);
  if (abo_->ziel.bildSeitUmhaengen) abo_->ziel.rawOffGesehen = true;
}

}  // namespace
