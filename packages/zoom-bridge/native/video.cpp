#include "video.h"
#include <map>
#include <memory>
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
  unsigned int userId = 0;
  std::string persistentId;
  std::string source;          // der TATSAECHLICH vergebene NDI-Name
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  IZoomSDKRenderer* renderer = nullptr;
  std::unique_ptr<Delegate> delegate;
  NdiSender sender;

  bool mismatchGemeldet = false;
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
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId) +
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
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") +
          ",\"rotation\":" + std::to_string(rotation) +
          ",\"limitedRange\":" + (limitedRange ? "true" : "false") + "}");
}

void emitVideoError(const char* code) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code + "\"}");
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

  auto sub = std::make_unique<Sub>();
  sub->userId = userId;
  sub->persistentId = persistentId;
  sub->res = res;
  sub->source = uniqueSourceName(name);
  sub->delegate = std::make_unique<Delegate>(sub.get());

  if (!sub->sender.open(sub->source)) { emitVideoError("videoSenderFailed"); return; }

  SDKError err = createRenderer(&sub->renderer, sub->delegate.get());
  if (err != SDKERR_SUCCESS || sub->renderer == nullptr) {
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }
  sub->renderer->setRawDataResolution(res);
  err = sub->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  if (err != SDKERR_SUCCESS) {
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
  emitVideo(*s, "unsubscribed", "command");
  // REIHENFOLGE IST TRAGEND: erst den Renderer abmelden und abbauen, DANN
  // den Sender schliessen. Andersherum koennte ein Bild-Rueckruf, der schon
  // unterwegs ist, auf einen bereits abgebauten Sender schreiben.
  if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
  s->sender.close();
  g_subs.erase(it);
}

void videoShutdownAll() {
  for (auto& [id, s] : g_subs) {
    if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
    s->sender.close();
  }
  g_subs.clear();
}

namespace {

void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  if (!data || !owner_) return;
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
    if (!owner_->mismatchGemeldet) {
      // EINMAL je Abo, nicht je Bild: 30 Meldungen je Sekunde ertraenkten
      // jede andere Ausgabe.
      owner_->mismatchGemeldet = true;
      emitVideoError("videoBufferMismatch");
      owner_->reason = "bufferMismatch";
    }
    return;   // das Abo bleibt bestehen und faellt ueber den Herzschlag auf Schwarz
  }

  owner_->lastFrameMs = GetTickCount64();
  owner_->lastW = w;
  owner_->lastH = h;
  owner_->sender.sendI420(buf, w, h);

  // Erst beim ERSTEN brauchbaren Bild sind rotation und limitedRange
  // gemessen - vorher waeren sie erfunden.
  const unsigned int rot = data->GetRotation();
  const bool limited = data->IsLimitedI420();
  if (!owner_->gemessen || owner_->state != "live" || owner_->rotation != rot || owner_->limitedRange != limited) {
    owner_->gemessen = true;
    owner_->rotation = rot;
    owner_->limitedRange = limited;
    owner_->state = "live";
    emitVideoMeasured(*owner_, "live", "frames", rot, limited);
  }
}

void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  if (!owner_) return;
  if (status == RawData_Off) {
    owner_->state = "black";
    owner_->reason = "cameraOff";
    emitVideo(*owner_, "black", "cameraOff");
  }
  // RawData_On erzeugt hier ABSICHTLICH kein Ereignis: dass das SDK Video
  // ankuendigt, heisst noch nicht, dass Bilder ankommen. "live" wird beim
  // ersten wirklich empfangenen Bild gemeldet - eine Ankuendigung ist keine
  // Messung.
}

}  // namespace
