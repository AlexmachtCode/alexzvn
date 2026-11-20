#include "ndi_sender.h"
#include "emit.h"
// NACHBESSERUNG (Runde 1, Befund 4): std::fill braucht dieses Include -
// bisher nur transitiv ueber <vector>/<mutex> im MSVC-Build verfuegbar,
// nicht garantiert.
#include <algorithm>
#include <atomic>
#include <cstring>
#include <string>

namespace {
// Der Bild-Versatz fuer ALLE Sender (videoDelay). ATOMAR: gesetzt wird auf
// dem Hauptthread (main.cpp), gelesen im Bild-Rueckruf auf Zooms SDK-Thread
// und im Herzschlag - ohne Sperre, weil ein Versatz, der einen Rueckruf zu
// spaet greift, harmlos ist, eine Sperre um jedes Bild dagegen nicht.
std::atomic<int> g_videoDelayMs{0};

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

void ndiSetVideoDelayMs(int ms) { g_videoDelayMs = ms; }

int ndiVideoDelayMs() { return g_videoDelayMs.load(); }

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

// Weiss im begrenzten Wertebereich: Y 235, U/V 128 (Spec 6.12) - dieselbe
// Begruendung wie Y 16 fuer Schwarz oben.
void fillWhiteI420(std::vector<uint8_t>& buf, int w, int h) {
  const size_t ySize = static_cast<size_t>(w) * h;
  const size_t cSize = ySize / 4;
  buf.assign(ySize + 2 * cSize, 0);
  std::fill(buf.begin(), buf.begin() + ySize, static_cast<uint8_t>(235));
  std::fill(buf.begin() + ySize, buf.end(), static_cast<uint8_t>(128));
}

// Transparent als UYVA (Processing.NDI.structs.h:63-67): UYVY-Ebene mit
// 2 Byte je Bildpunkt (U Y V Y je Bildpunktpaar, hier Schwarz 128/16/128/16),
// DIREKT dahinter die Alpha-Ebene mit 1 Byte je Bildpunkt, alle 0.
void fillTransparentUYVA(std::vector<uint8_t>& buf, int w, int h) {
  const size_t uyvy = static_cast<size_t>(w) * h * 2;
  buf.assign(uyvy + static_cast<size_t>(w) * h, 0);
  for (size_t i = 0; i + 3 < uyvy; i += 4) {
    buf[i] = 128;
    buf[i + 1] = 16;
    buf[i + 2] = 128;
    buf[i + 3] = 16;
  }
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

// Wie fillFrame(), aber UYVA: der Zeilenabstand gilt der UYVY-Ebene und ist
// 2 * Breite (zwei Byte je Bildpunkt); die Alpha-Ebene folgt ohne Angabe
// direkt dahinter (Processing.NDI.structs.h:63-67). Dass Empfaenger den Wechsel UYVA/I420 je Bild verkraften, ist ANNAHME AN5 (unbelegt, MS12).
void fillFrameUyva(NDIlib_video_frame_v2_t& f, const uint8_t* buf, int w, int h) {
  fillFrame(f, buf, w, h);
  f.FourCC = NDIlib_FourCC_video_type_UYVA;
  f.line_stride_in_bytes = 2 * w;
}
}  // namespace

namespace {
// Verworfene Bilder MELDEN, nicht still schlucken - aber AUSSERHALB der
// Sender-Sperre (emitLog schreibt auf stderr, das darf keinen Sendeweg
// aufhalten). Die Zeile nennt ALLE drei Anlaesse, die zu mehr als
// DelayLine::kMaxBurst faelligen Bildern auf einmal fuehren - welcher es war,
// laesst sich hier nicht unterscheiden, und eine Zeile, die nur zwei davon
// nennt, schickte die Suche beim dritten in die falsche Richtung (Review
// 30.09.2026).
void meldeVerworfen(int n) {
  if (n <= 0) return;
  emitLog(L"Bild-Versatz: " + std::to_wstring(n) +
          L" wartende(s) Bild(er) verworfen - Versatz verkleinert, Ausgabe stand, "
          L"oder Zoom lieferte mehrere Bilder auf einmal.");
}
}  // namespace

void NdiSender::sendI420(const uint8_t* buf, int width, int height) {
  std::unique_lock<std::mutex> lock(mutex_);
  if (!send_ || !buf || width <= 0 || height <= 0) return;
  const int versatz = versatzMsLocked();
  // "ohne Versatz" (Freigabe-Slots, Spec 6.14): immer direkt, nie pushFrame. Haelt ein anderer Thread die Staffel
  // (#310), reiht sich das Bild ein - sonst ueberholte es die Bilder, die er gerade ausgibt.
  if (ohneVersatz_ || (versatz == 0 && delay_.size() == 0 && !ausgabeLaeuft_)) {
    NDIlib_video_frame_v2_t f;
    fillFrame(f, buf, width, height);
    // Kehrt erst zurueck, wenn der Puffer ausgelesen ist - deshalb duerfen
    // wir Zooms Puffer direkt durchreichen, ohne AddRef().
    NDIlib_send_send_video_v2(send_, &f);
    return;
  }
  // Groesse aus Breite x Hoehe, nicht aus GetBufferLen(): der Bild-Rueckruf
  // (video.cpp) hat genau diese Gleichheit schon geprueft und verwirft jedes
  // Bild, bei dem sie nicht gilt.
  const size_t len = static_cast<size_t>(width) * height * 3 / 2;
  letzteBildBytes_ = len;
  const int verdraengt = delay_.pushFrame(buf, len, width, height, DelayLine::Clock::now());
  zaehler_.verworfen += static_cast<unsigned int>(verdraengt);
  const int verworfen = verdraengt + releaseDueLocked(lock, false);
  lock.unlock();
  meldeVerworfen(verworfen);
}

bool NdiSender::direktFrei() {
  std::lock_guard<std::mutex> lock(mutex_);
  return send_ && (ohneVersatz_ || (versatzMsLocked() == 0 && delay_.size() == 0 && !ausgabeLaeuft_));
}

void NdiSender::sendI420Einpassen(const uint8_t* i420, int w, int h, int rahmenW, int rahmenH) {
  std::unique_lock<std::mutex> lock(mutex_);
  if (!send_ || !i420 || w <= 0 || h <= 0 || rahmenW <= 0 || rahmenH <= 0) return;
  // Immer durch die Warteschlange, auch bei Versatz 0: eingepasst wird nur beim Ausgeben, ausserhalb von mutex_.
  const size_t len = einpass::i420Bytes(w, h);
  letzteBildBytes_ = len;
  const int verdraengt = delay_.pushEinpassen(i420, len, w, h, rahmenW, rahmenH, DelayLine::Clock::now());
  zaehler_.verworfen += static_cast<unsigned int>(verdraengt);
  const int verworfen = verdraengt + releaseDueLocked(lock, false);
  lock.unlock();
  meldeVerworfen(verworfen);
}

void NdiSender::sendBlackLocked(int width, int height) {
  if (blackW_ != width || blackH_ != height) {
    fillBlackI420(black_, width, height);
    blackW_ = width;
    blackH_ = height;
  }
  NDIlib_video_frame_v2_t f;
  fillFrame(f, black_.data(), width, height);
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::sendWhiteLocked(int width, int height) {
  if (whiteW_ != width || whiteH_ != height) {
    fillWhiteI420(white_, width, height);
    whiteW_ = width;
    whiteH_ = height;
  }
  NDIlib_video_frame_v2_t f;
  fillFrame(f, white_.data(), width, height);
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::sendUYVALocked(const uint8_t* buf, int width, int height) {
  NDIlib_video_frame_v2_t f;
  fillFrameUyva(f, buf, width, height);
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::sendTransparentLocked(int width, int height) {
  if (transparentW_ != width || transparentH_ != height) {
    fillTransparentUYVA(transparent_, width, height);
    transparentW_ = width;
    transparentH_ = height;
  }
  sendUYVALocked(transparent_.data(), width, height);
}

int NdiSender::versatzMsLocked() const { return ohneVersatz_ ? 0 : ndiVideoDelayMs(); }

void NdiSender::sendErsatz(Bildart art, int width, int height) {
  std::unique_lock<std::mutex> lock(mutex_);
  if (!send_ || width <= 0 || height <= 0) return;
  if (ohneVersatz_ || (versatzMsLocked() == 0 && delay_.size() == 0 && !ausgabeLaeuft_)) {
    if (art == Bildart::Weiss) sendWhiteLocked(width, height);
    else if (art == Bildart::Transparent) sendTransparentLocked(width, height);
    else sendBlackLocked(width, height);
    return;
  }
  const int verdraengt = delay_.pushBild(art, width, height, DelayLine::Clock::now());
  zaehler_.verworfen += static_cast<unsigned int>(verdraengt);
  const int verworfen = verdraengt + releaseDueLocked(lock, false);
  lock.unlock();
  meldeVerworfen(verworfen);
}

void NdiSender::sendKachel(std::shared_ptr<const std::vector<uint8_t>> i420, int width, int height) {
  std::unique_lock<std::mutex> lock(mutex_);
  if (!send_ || !i420 || width <= 0 || height <= 0) return;
  const size_t erwartet = static_cast<size_t>(width) * static_cast<size_t>(height) +
                          2 * static_cast<size_t>(width / 2) * static_cast<size_t>(height / 2);
  if (i420->size() != erwartet) return;
  if (ohneVersatz_ || (versatzMsLocked() == 0 && delay_.size() == 0 && !ausgabeLaeuft_)) {
    NDIlib_video_frame_v2_t f;
    fillFrame(f, i420->data(), width, height);
    NDIlib_send_send_video_v2(send_, &f);
    return;
  }
  const int verdraengt = delay_.pushKachel(std::move(i420), width, height, DelayLine::Clock::now());
  zaehler_.verworfen += static_cast<unsigned int>(verdraengt);
  const int verworfen = verdraengt + releaseDueLocked(lock, false);
  lock.unlock();
  meldeVerworfen(verworfen);
}

void NdiSender::sendBlack(int width, int height) { sendErsatz(Bildart::Schwarz, width, height); }

void NdiSender::sendWhite(int width, int height) { sendErsatz(Bildart::Weiss, width, height); }

void NdiSender::sendTransparent(int width, int height) { sendErsatz(Bildart::Transparent, width, height); }

void NdiSender::sendUYVA(const uint8_t* buf, int width, int height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_ || !buf || width <= 0 || height <= 0) return;
  sendUYVALocked(buf, width, height);
}

void NdiSender::sendCopy(const FrameCopy& c) {
  std::lock_guard<std::mutex> lock(c.m);
  if (c.i420.empty() || c.w <= 0 || c.h <= 0) return;
  sendI420(c.i420.data(), c.w, c.h);
}

void NdiSender::setOhneVersatz(bool an) {
  std::lock_guard<std::mutex> lock(mutex_);
  ohneVersatz_ = an;
}

void NdiSender::leereVersatz() {
  std::lock_guard<std::mutex> lock(mutex_);
  ++generation_;   // auch was ein Staffelhalter schon entnommen hat, geht nicht mehr hinaus (#310)
  delay_.clear();
}

size_t NdiSender::speicherBytes() {
  std::lock_guard<std::mutex> lock(mutex_);
  // faellig_: Bilder, die der Staffelhalter gerade ausgibt (#310) - weder in der Warteschlange noch im Vorrat.
  return (delay_.size() + delay_.spareBuffers() + faellig_.size()) * letzteBildBytes_ + black_.capacity() +
         white_.capacity() + transparent_.capacity() + ausgabeRahmenBytes_;
}

void NdiSender::pump() {
  std::unique_lock<std::mutex> lock(mutex_);
  if (!send_ || delay_.size() == 0) return;
  const int verworfen = releaseDueLocked(lock, true);
  lock.unlock();
  meldeVerworfen(verworfen);
}

NdiSender::DelayZaehler NdiSender::takeDelayZaehler() {
  std::lock_guard<std::mutex> lock(mutex_);
  const DelayZaehler z = zaehler_;
  zaehler_ = DelayZaehler{};
  return z;
}

int NdiSender::releaseDueLocked(std::unique_lock<std::mutex>& lock, bool nachlauf) {
  // Ein anderer Thread haelt die Staffel (#310) und gibt gerade aus - nichts entnehmen. Das eben eingereihte Bild geht
  // beim naechsten Anstoss (naechstes Bild oder Nachlauf); so wartet niemand auf eine fremde Einpassung.
  if (ausgabeLaeuft_) return 0;
  const auto versatz = std::chrono::milliseconds(versatzMsLocked());
  const auto senke = [this](const DelayLine::Frame& b) {
    if (b.art == Bildart::Schwarz) {
      sendBlackLocked(b.w, b.h);
      return;
    }
    if (b.art == Bildart::Weiss) {
      sendWhiteLocked(b.w, b.h);
      return;
    }
    if (b.art == Bildart::Transparent) {
      sendTransparentLocked(b.w, b.h);
      return;
    }
    if (b.art == Bildart::Kachel) {
      // Eine Kachel ohne Puffer legt die Warteschlange nie ab (pushKachel, pushBild, #306); die Senke prüft trotzdem
      // selbst, statt sich darauf zu verlassen.
      if (b.kachel) {
        NDIlib_video_frame_v2_t k;
        fillFrame(k, b.kachel->data(), b.w, b.h);
        NDIlib_send_send_video_v2(send_, &k);
      }
      return;
    }
    NDIlib_video_frame_v2_t f;
    fillFrame(f, b.data.data(), b.w, b.h);
    // Synchron: kehrt erst zurueck, wenn NDI den Puffer ausgelesen hat -
    // danach darf die Warteschlange ihn wiederverwenden.
    NDIlib_send_send_video_v2(send_, &f);
  };
  const auto jetzt = DelayLine::Clock::now();
  // Nachlauf: dieselbe Regel mit vorgezogener Uhr, genau wie DelayLine::releaseNachlauf.
  const auto r = delay_.entnehmen(nachlauf ? jetzt - DelayLine::kNachlaufKarenz : jetzt, versatz, faellig_);
  zaehler_.verworfen += static_cast<unsigned int>(r.dropped);
  // Der Stand beim Entnehmen: aendert er sich in einer Einpass-Luecke (leereVersatz, close), gehoert der Rest von
  // faellig_ zum alten Stand und geht nicht mehr hinaus - genau wie die von leereVersatz geleerten Bilder.
  const uint32_t generation = generation_;
  unsigned int ausgegeben = 0;
  ausgabeLaeuft_ = true;
  for (const DelayLine::Frame& b : faellig_) {
    if (b.art != Bildart::Einpassen) {
      if (send_) senke(b);
      ++ausgegeben;
      continue;
    }
    // Einpassen OHNE mutex_ (bis ~2 ms je Bild): ausgabeRahmen_ und faellig_ fasst solange nur der Staffelhalter an.
    // Wer jetzt sendet, reiht ein (ausgabeLaeuft_; nur "ohne Versatz" und sendUYVA reihen nie ein). leereVersatz()
    // und close() duerfen laufen - darum danach die Generation pruefen.
    lock.unlock();
    einpass::rahmenVorbereiten(ausgabeRahmen_, b.rahmenW, b.rahmenH, einpass::bildFlaeche(b.w, b.h, b.rahmenW, b.rahmenH));
    einpass::einpassen(b.data.data(), b.w, b.h, ausgabeRahmen_);
    lock.lock();
    ausgabeRahmenBytes_ = einpass::speicherBytes(ausgabeRahmen_);
    if (generation_ != generation) break;
    if (send_) sendUYVALocked(ausgabeRahmen_.daten.data(), b.rahmenW, b.rahmenH);
    ++ausgegeben;
  }
  // Gezaehlt wird, was hinausging. Was nach leereVersatz/close liegen blieb, ist weder ausgegeben noch "verworfen"
  // (meldeVerworfen nennt Versatz/Ausgabe/Zoom als Anlass - hier waere es der Moduswechsel oder der Abbau).
  if (nachlauf) zaehler_.imNachlauf += ausgegeben;
  else zaehler_.beimEinreihen += ausgegeben;
  delay_.zuruecklegen(faellig_);
  ausgabeLaeuft_ = false;
  return r.dropped;
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
  const size_t n = static_cast<size_t>(sampleCount) * static_cast<size_t>(channels);
  if (limitPuffer_.size() < n) limitPuffer_.resize(n);
  std::memcpy(limitPuffer_.data(), samples, n * sizeof(int16_t));
  limiter_.verarbeite(limitPuffer_.data(), sampleCount, sampleRate, channels);
  sendAudioLocked(limitPuffer_.data(), sampleCount, sampleRate, channels);
}

slotlogic::PegelFenster NdiSender::takePegel() {
  std::lock_guard<std::mutex> lock(mutex_);
  return limiter_.abholen();
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
  // Wartende Bilder gehen mit dem Sender: die Quelle verschwindet ohnehin,
  // und der Vorrat haelt bei 1080p mehrere Dutzend MB. Ebenso, was ein
  // Staffelhalter schon entnommen hat (#310, generation_).
  ++generation_;
  delay_.clear();
  if (!send_) return;
  NDIlib_send_destroy(send_);
  send_ = nullptr;
}
