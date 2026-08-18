#include "ndi_sender.h"
#include "emit.h"
// NACHBESSERUNG (Runde 1, Befund 4): std::fill braucht dieses Include -
// bisher nur transitiv ueber <vector>/<mutex> im MSVC-Build verfuegbar,
// nicht garantiert.
#include <algorithm>

namespace {
// Ob NDIlib_initialize() in diesem Prozess geglueckt ist. Hier und nicht in
// main.cpp: diese Uebersetzungseinheit BESITZT den NDI-Zustand, und ein
// zweites Merkzeichen daneben waeren zwei Wahrheiten, die auseinanderlaufen
// koennen. Kein std::atomic noetig - gesetzt wird ausschliesslich auf dem
// Hauptthread (main.cpp, Befehl "init" bzw. der --ndi-selftest-Sonderweg),
// gelesen ebenfalls nur dort (videoSubscribe() laeuft auf demselben Thread).
bool g_ndiUp = false;
}  // namespace

bool ndiInitialize() {
  g_ndiUp = NDIlib_initialize();
  return g_ndiUp;
}

bool ndiIsUp() { return g_ndiUp; }

void ndiShutdown() {
  NDIlib_destroy();
  g_ndiUp = false;
}

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

// Baut den Audio-Frame und sendet ihn. Setzt voraus, dass der Aufrufer
// mutex_ bereits haelt (siehe Deklaration in ndi_sender.h fuer die
// Begruendung: Vergroessern von silence_ und der Sendeaufruf muessen in
// DERSELBEN kritischen Sektion liegen, sonst kann sich der zuvor gelesene
// .data()-Zeiger zwischen Pruefung und Senden verschieben).
void NdiSender::sendAudioLocked(const int16_t* samples, int sampleCount, int sampleRate, int channels) {
  if (send_ == nullptr) return;
  NDIlib_audio_frame_interleaved_16s_t f;
  f.sample_rate = sampleRate;
  f.no_channels = channels;
  f.no_samples = sampleCount;
  // Die Taktung erzeugt NDI selbst. Eigene Zeitstempel aus Zooms
  // GetTimeStamp() waeren erst dann richtig, wenn gemessen ist, dass die
  // synthetische Taktung Bild und Ton auseinanderlaufen laesst (Spec
  // Abschnitt 8, Abnahmepunkt 5).
  f.timecode = NDIlib_send_timecode_synthesize;
  // +0 dB. ZITAT, und danach eine ANNAHME - die beiden gehoeren getrennt
  // (Schlusspruefung Stage 3, Important 9; vorher standen sie in einem Satz,
  // was die Annahme wie einen Beleg aussehen liess):
  //
  // ZITIERT aus dem Kopfsatz der NDI-SDK, fuer das SENDEN: "specify +0 dB.
  // Most common applications produce audio at reference level."
  //
  // ANGENOMMEN, auf diesem Zweig NIRGENDS gemessen: dass Zoom seinen Ton
  // ebenfalls auf Referenzpegel liefert. Kein Lauf dieses Zweigs hat je einen
  // Pegel gesehen - ndi-probe hoert die Stille UNSERES eigenen Selbsttest-
  // Senders, nicht Zoom. Liegt Zoom daneben, ist die Folge ein durchgehend zu
  // leiser oder zu lauter Eingang im Switcher, nicht ein Ausfall. "Pegel
  // plausibel?" steht darum auf der Owner-Abnahmeliste (README,
  // docs/roadmap.md); erst danach darf hier eine gemessene Zahl stehen.
  f.reference_level = 0;
  f.p_data = const_cast<int16_t*>(samples);
  NDIlib_util_send_send_audio_interleaved_16s(send_, &f);
}

void NdiSender::sendAudio(const int16_t* samples, int sampleCount, int sampleRate, int channels) {
  if (samples == nullptr || sampleCount <= 0 || channels <= 0) return;
  std::lock_guard<std::mutex> lock(mutex_);
  sendAudioLocked(samples, sampleCount, sampleRate, channels);
}

void NdiSender::sendSilence(int sampleCount, int sampleRate, int channels) {
  if (sampleCount <= 0 || channels <= 0) return;
  const size_t noetig = static_cast<size_t>(sampleCount) * static_cast<size_t>(channels);
  std::lock_guard<std::mutex> lock(mutex_);
  if (send_ == nullptr) return;
  if (silence_.size() < noetig) silence_.assign(noetig, 0);
  // NACHBESSERUNG: Vergroessern (silence_.assign - kann NEU ALLOZIEREN) und
  // Senden liegen jetzt in DERSELBEN kritischen Sektion. Vorher wurde die
  // Sperre dazwischen kurz losgelassen: die Gefahr war NICHT, dass sich der
  // INHALT des Puffers aendert (er ist immer Null), sondern dass sich seine
  // ADRESSE verschiebt - ein zwischen Loslassen und sendAudio() gelesener
  // .data()-Zeiger haette dann auf bereits freigegebenen Speicher zeigen
  // koennen, wenn ein zweiter Aufrufer in der Luecke vergroessert.
  //
  // Dass hier ueber sendAudioLocked() (also ueber den eigentlichen
  // Sendeaufruf) hinweg gesperrt bleibt, verstoesst NICHT gegen die
  // Kernregel "eine Sperre nie ueber einen NDI-Sendeaufruf halten": diese
  // Regel verbietet, eine FREMDE Sperre (z. B. eines Subs fieldMutex) ueber
  // einen Sendeaufruf zu halten - NdiSender darf und muss seine EIGENE
  // Sperre um seinen EIGENEN Sendeaufruf legen, genau wie sendBlack() es
  // fuer black_ bereits tut.
  sendAudioLocked(silence_.data(), sampleCount, sampleRate, channels);
}

void NdiSender::close() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_) return;
  NDIlib_send_destroy(send_);
  send_ = nullptr;
}
