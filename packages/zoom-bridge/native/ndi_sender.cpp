#include "ndi_sender.h"
#include "emit.h"

bool ndiInitialize() { return NDIlib_initialize(); }
void ndiShutdown() { NDIlib_destroy(); }

NdiSender::~NdiSender() { close(); }

bool NdiSender::open(const std::string& nameUtf8) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (send_) return true;
  NDIlib_send_create_t desc;
  desc.p_ndi_name = nameUtf8.c_str();
  desc.p_groups = nullptr;
  desc.clock_video = false;   // Zoom taktet, nicht wir
  desc.clock_audio = false;
  send_ = NDIlib_send_create(&desc);
  return send_ != nullptr;
}

namespace {
// Fuellt einen I420-Puffer mit Schwarz.
//
// WARUM Y=16 UND NICHT Y=0: 16/128/128 ist Schwarz im BEGRENZTEN
// Wertebereich (der Rundfunk-Konvention, die NDI fuer I420 annimmt). Y=0
// waere dort "schwaerzer als schwarz" - ein unzulaessiger Wert, den
// Empfaenger unterschiedlich behandeln. Liefert Zoom wider Erwarten den
// VOLLEN Wertebereich (IsLimitedI420() == false), erscheint 16 als sehr
// dunkles Grau statt als Schwarz - sichtbar, aber harmlos. Der umgekehrte
// Fehler waere schlimmer.
void fillBlackI420(std::vector<uint8_t>& buf, int w, int h) {
  const size_t ySize = static_cast<size_t>(w) * h;
  const size_t cSize = ySize / 4;
  buf.assign(ySize + 2 * cSize, 0);
  std::fill(buf.begin(), buf.begin() + ySize, static_cast<uint8_t>(16));
  std::fill(buf.begin() + ySize, buf.end(), static_cast<uint8_t>(128));
}

void fillFrame(NDIlib_video_frame_v2_t& f, const uint8_t* buf, int w, int h) {
  f.xres = w;
  f.yres = h;
  f.FourCC = NDIlib_FourCC_video_type_I420;
  f.frame_rate_N = 30000;
  f.frame_rate_D = 1001;
  f.picture_aspect_ratio = 0.0f;  // 0 = aus xres/yres ableiten
  f.frame_format_type = NDIlib_frame_format_type_progressive;
  f.timecode = NDIlib_send_timecode_synthesize;
  f.p_data = const_cast<uint8_t*>(buf);
  // Bei I420 ist das der Zeilenabstand der Y-Ebene.
  f.line_stride_in_bytes = w;
  f.p_metadata = nullptr;
}
}  // namespace

void NdiSender::sendI420(const uint8_t* buf, int width, int height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_ || !buf || width <= 0 || height <= 0) return;
  NDIlib_video_frame_v2_t f;
  fillFrame(f, buf, width, height);
  // Kehrt erst zurueck, wenn der Puffer ausgelesen ist - deshalb duerfen
  // wir Zooms Puffer direkt durchreichen, ohne AddRef().
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::sendBlack(int width, int height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_ || width <= 0 || height <= 0) return;
  if (blackW_ != width || blackH_ != height) {
    fillBlackI420(black_, width, height);
    blackW_ = width;
    blackH_ = height;
  }
  NDIlib_video_frame_v2_t f;
  fillFrame(f, black_.data(), width, height);
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::close() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_) return;
  NDIlib_send_destroy(send_);
  send_ = nullptr;
}
