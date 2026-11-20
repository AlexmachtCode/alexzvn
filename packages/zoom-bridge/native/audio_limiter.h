#pragma once
// Ton-Limiter je Slot mit Pegelfenster (Entwurf 2026-11-14, Connect: Ton-Limiter und Pegelmessung).
//
// REINE LOGIK wie audio_mix.h: nur die C++-Standardbibliothek, keine Zeit von aussen, ohne Zoom und NDI
// (native/audio_limiter_test.cpp, npm run logik-test).
//
// Verhalten: Einsatz sofort, ohne Vorausschau und ohne Puffern ueber Pakete hinweg (also keine zusaetzliche
// Latenz); Rueckkehr weich mit kRueckkehrDbJeSekunde, danach wieder EXAKT Verstaerkung 1. Solange nichts
// abgesenkt ist, gehen die Abtastwerte bitgenau durch. Mehrkanal: eine gemeinsame Absenkung fuer alle Kanaele
// (Spitze = groesster Betrag eines Frames). Formatwechsel (Rate/Kanaele) setzt die Absenkung zurueck.
// Das Pegelfenster misst die Werte VOR dem Limiter, also so, wie Zoom sie geliefert hat.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>

namespace slotlogic {

/** Grenze in dBFS. PLATZHALTER, bis ein Testmeeting den Zoom-Pegel gemessen hat. */
constexpr double kTonGrenzeDbfs = -6.0;
/** Rueckkehr der Absenkung: 6 dB in 150 ms. */
constexpr double kRueckkehrDbJeSekunde = 40.0;

/** Messwerte seit dem letzten abholen(), alle VOR dem Limiter. */
struct PegelFenster {
  int32_t spitze = 0;             // groesster Betrag, 0 ... 32768
  double summeQuadrate = 0.0;     // ueber alle Werte aller Kanaele
  int64_t werte = 0;              // Anzahl Werte aller Kanaele
  int64_t vollausschlag = 0;      // Werte == 32767 oder == -32768
  int pakete = 0;
  int paketeMitEingriff = 0;
  double staerksteAbsenkungDb = 0.0;   // >= 0
};

class TonLimiter {
 public:
  explicit TonLimiter(double grenzeDbfs = kTonGrenzeDbfs)
      : grenze_(static_cast<int32_t>(32768.0 * std::pow(10.0, grenzeDbfs / 20.0))) {}

  /** Grenze als Betrag in Abtastwerten (-6 dBFS ergibt 16422). */
  int32_t grenze() const { return grenze_; }
  /** Aktuelle Absenkung in dB; 0 heisst exakt Verstaerkung 1. */
  double absenkungDb() const { return absenkungDb_; }

  /** Begrenzt abtastwerteJeKanal Frames (verschraenkt, abtastwerteJeKanal * kanaele Werte) an Ort und Stelle. */
  void verarbeite(int16_t* werte, int abtastwerteJeKanal, int rate, int kanaele) {
    if (werte == nullptr || abtastwerteJeKanal <= 0 || rate <= 0 || kanaele <= 0) return;
    if (rate != rate_ || kanaele != kanaele_) {   // Formatwechsel: die alte Absenkung passt nicht mehr
      absenkungDb_ = 0.0;
      rate_ = rate;
      kanaele_ = kanaele;
    }
    const double schritt = kRueckkehrDbJeSekunde / static_cast<double>(rate);
    bool eingriff = false;
    for (int f = 0; f < abtastwerteJeKanal; ++f) {
      int16_t* frame = werte + static_cast<size_t>(f) * static_cast<size_t>(kanaele);
      if (absenkungDb_ > 0.0) {
        absenkungDb_ -= schritt;
        if (absenkungDb_ <= 0.0) absenkungDb_ = 0.0;
      }
      int32_t spitze = 0;
      for (int c = 0; c < kanaele; ++c) {
        const int32_t x = frame[c];
        const int32_t betrag = x < 0 ? -x : x;
        spitze = std::max(spitze, betrag);
        fenster_.summeQuadrate += static_cast<double>(x) * static_cast<double>(x);
        if (x == 32767 || x == -32768) ++fenster_.vollausschlag;
      }
      fenster_.werte += kanaele;
      fenster_.spitze = std::max(fenster_.spitze, spitze);
      double g = absenkungDb_ == 0.0 ? 1.0 : std::pow(10.0, -absenkungDb_ / 20.0);
      if (static_cast<double>(spitze) * g > static_cast<double>(grenze_)) {
        g = static_cast<double>(grenze_) / static_cast<double>(spitze);
        absenkungDb_ = -20.0 * std::log10(g);
      }
      if (absenkungDb_ == 0.0) continue;   // bitgenau durch
      eingriff = true;
      fenster_.staerksteAbsenkungDb = std::max(fenster_.staerksteAbsenkungDb, absenkungDb_);
      for (int c = 0; c < kanaele; ++c) {
        const int32_t y = static_cast<int32_t>(static_cast<double>(frame[c]) * g);   // trunc
        frame[c] = static_cast<int16_t>(std::clamp<int32_t>(y, -grenze_, grenze_));
      }
    }
    ++fenster_.pakete;
    if (eingriff) ++fenster_.paketeMitEingriff;
  }

  /** Gibt das Pegelfenster seit dem letzten Abholen zurueck und beginnt ein neues. */
  PegelFenster abholen() {
    PegelFenster r = fenster_;
    fenster_ = PegelFenster{};
    return r;
  }

 private:
  int32_t grenze_;
  double absenkungDb_ = 0.0;
  int rate_ = 0;
  int kanaele_ = 0;
  PegelFenster fenster_;
};

}  // namespace slotlogic
