#include "audio.h"
#include <atomic>
#include <cstring>
#include <deque>
#include <mutex>
#include "emit.h"
// DIESELBE UEBERSETZUNGSFALLE wie in video.h/session.h, hier GEMESSEN statt
// vermutet (`npm run rebuild -w @jm/zoom-bridge` brach ohne diese Zeile mit
// derselben C3646/C4430/C2872-Kaskade in zoom_sdk_def.h ab): unter WIN32
// setzt dieser Header HWND als bereits bekannt voraus und typedef't es selbst
// nur im Nicht-WIN32-Zweig. audio.h bleibt bewusst frei von jedem
// Zoom-Include (siehe dort) - windows.h muss darum HIER stehen, vor dem
// ersten Zoom-Header dieser Datei.
#include <windows.h>
#include "rawdata/zoom_rawdata_api.h"
#include "rawdata/rawdata_audio_helper_interface.h"
#include "zoom_sdk_raw_data_def.h"

USING_ZOOM_SDK_NAMESPACE

namespace {

// 256 Plaetze: bei 5 Teilnehmern, 32 kHz Mono und 10-ms-Paketen sind das rund
// 500 Pakete je Sekunde - der Vorrat reicht also ueber eine halbe Sekunde,
// waehrend geleert wird alle 10 ms. Gross genug fuer einen Hakler, klein
// genug, um bei einem echten Haenger nicht ins Uferlose zu wachsen.
constexpr size_t kMaxPakete = 256;

std::mutex g_queueMutex;
std::deque<AudioPacket> g_queue;
std::atomic<unsigned int> g_verworfen{0};
std::atomic<bool> g_abonniert{false};

class AudioDelegate : public IZoomSDKAudioRawDataDelegate {
 public:
  // NICHT GENUTZT, aber Pflicht: die Schnittstelle ist rein virtuell. Der
  // Mischton, der Bildschirmton und der Dolmetscherton stehen ausdruecklich
  // NICHT im Umfang (Spec Abschnitt 10) - leere Rumpfe sind hier die
  // ehrliche Umsetzung, kein Versehen.
  void onMixedAudioRawDataReceived(AudioRawData* /*data*/) override {}
  void onShareAudioRawDataReceived(AudioRawData* /*data*/, uint32_t /*userId*/) override {}
  void onOneWayInterpreterAudioRawDataReceived(AudioRawData* /*data*/, const zchar_t* /*lang*/) override {}

  void onOneWayAudioRawDataReceived(AudioRawData* data, uint32_t userId) override {
    if (data == nullptr) return;
    const char* buf = data->GetBuffer();
    const unsigned int len = data->GetBufferLen();
    const int rate = static_cast<int>(data->GetSampleRate());
    const int ch = static_cast<int>(data->GetChannelNum());
    if (buf == nullptr || len == 0 || rate <= 0 || ch <= 0) return;

    AudioPacket p;
    p.userId = userId;
    p.sampleRate = rate;
    p.channels = ch;
    // Die Pufferpruefung (Vielfaches von channels*2) macht der HAUPTTHREAD
    // beim Leeren, nicht hier: "einmal je Abo" braucht ein Merkzeichen am
    // Sub, und genau das darf dieser Rueckruf nicht anfassen. Hier wird nur
    // so gerechnet, dass nichts ueberlaeuft.
    //
    // bufferLen VOR den beiden Teilungen sichern (Nachbesserung): sowohl
    // sampleCount als auch samples.size() unten entstehen durch dieselbe
    // Ganzzahl-Division von len und verlieren dabei einen etwaigen Rest
    // GLEICHERMASSEN - aus den beiden Ergebnissen laesst sich danach nicht
    // mehr rekonstruieren, ob len ein ganzzahliges Vielfaches von channels*2
    // war. Nur len selbst traegt diese Information noch.
    p.bufferLen = len;
    p.sampleCount = static_cast<int>(len / (sizeof(int16_t) * static_cast<unsigned int>(ch)));
    p.samples.resize(len / sizeof(int16_t));
    std::memcpy(p.samples.data(), buf, p.samples.size() * sizeof(int16_t));

    std::lock_guard<std::mutex> lock(g_queueMutex);
    // DAS AELTESTE fliegt raus, nicht das neue: verspaeteter Ton ist wertlos.
    while (g_queue.size() >= kMaxPakete) {
      g_queue.pop_front();
      g_verworfen.fetch_add(1);
    }
    g_queue.push_back(std::move(p));
  }
};

// Prozesslang. Damit hat der Lauscher SELBST keine Lebensdauerfrage - nur die
// Abos haben eine, und die loest der Weg ueber die Warteschlange.
AudioDelegate g_delegate;

}  // namespace

bool audioEnsureSubscribed() {
  if (g_abonniert.load()) return true;
  IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
  if (helper == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioHelperMissing\"}");
    return false;
  }
  // false: siehe audio.h - schuetzt die Dolmetscher-App (#208).
  const SDKError err = helper->subscribe(&g_delegate, false);
  if (err != SDKERR_SUCCESS) {
    emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei subscribe() fuer den Ton: SDKError=") +
            std::to_wstring(static_cast<int>(err)));
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioSubscribeFailed\"}");
    return false;
  }
  g_abonniert = true;
  return true;
}

void audioClearSubscribed() {
  g_abonniert = false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  // Pakete aus einem beendeten Meeting gehoeren niemandem mehr.
  g_queue.clear();
  g_verworfen = 0;
}

void audioShutdown() {
  if (g_abonniert.load()) {
    IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
    if (helper != nullptr) helper->unSubscribe();
  }
  audioClearSubscribed();
}

bool audioPop(AudioPacket* out) {
  if (out == nullptr) return false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  if (g_queue.empty()) return false;
  *out = std::move(g_queue.front());
  g_queue.pop_front();
  return true;
}

unsigned int audioTakeOverflowCount() {
  return g_verworfen.exchange(0);
}
