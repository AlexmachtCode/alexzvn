#pragma once
// Mischer eines Mischer-Slots: Freigabe mit Mischton (Eingang A) und Computerton (Eingang B), Tonweg mixShare
// (Spec 6.13, 0.35, B17, Restnachfix N1).
//
// REINE LOGIK wie slot_logic.h: nur die C++-Standardbibliothek, jede Zeit in Millisekunden von aussen
// (native/audio_mix_test.cpp, npm run logik-test; G-A2).
//
// Die Ausgabe folgt der WANDUHR: Jeder Aufruf von ausgabe() gibt genau die seit der letzten Ausgabe verstrichene
// Zeit aus, in 10-ms-Schritten, hoechstens aber 200 ms (Nachtrag N1.1, bewusste Abweichung von Spec 6.13 „genau die
// verstrichene Zeit“ nur fuer den Fehlerfall): Nach einem Haenger der Hauptschleife (Ruhezustand) baute ein Aufruf
// sonst die ganze Luecke als Stille (~230 MB je Stunde bei 32 kHz). Ist mehr verstrichen, zieht der Mischer seine
// Uhr auf jetzt - 200 ms nach; der Rest gilt als verworfen und zaehlt in mixDropsMs.
// Der Mischer beginnt, sobald ein Eingang 40 ms Vorlauf hat. Fehlt einem Eingang etwas, fuellt er dessen Anteil mit
// Stille auf, statt zu warten (mixSilenceMs). Die Summe wird auf den 16-Bit-Bereich begrenzt. Rueckstand ueber
// 200 ms je Eingang wird am aeltesten Ende verworfen (mixDropsMs). Passen Rate oder Kanalzahl der Eingaenge nicht
// zusammen, geht nur der Computerton hinaus (rateMismatch, T76). So sendet ein Mischer-Slot nie mehr Ton als
// Wanduhrzeit, und ein Aussetzer laesst keinen bleibenden Rueckstand zurueck.
// „Neu“ (Plan-Schritt MischerNeu) heisst `mix = AudioMix{}`; MischerEingangBNeu heisst eingangBNeu().
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <vector>

namespace slotlogic {

class AudioMix {
 public:
  static constexpr int64_t kSchrittMs = 10;
  static constexpr int64_t kVorlaufMs = 40;
  static constexpr int64_t kRueckstandMs = 200;
  /** Hoechstens so viel Zeit gibt ein Aufruf von ausgabe() aus (wie der Stille-Herzschlag; Nachtrag N1.1). */
  static constexpr int64_t kAusgabeHoechstensMs = 200;

  /** Mischton: n Abtastwerte je Kanal, verschraenkt (n * kanaele Werte), angekommen zur Zeit ms. */
  void eingangA(const int16_t* abtast, int n, int rate, int kanaele, int64_t ms) { eingang(a_, abtast, n, rate, kanaele, ms); }
  /** Computerton der gezeigten Freigabe. */
  void eingangB(const int16_t* abtast, int n, int rate, int kanaele, int64_t ms) { eingang(b_, abtast, n, rate, kanaele, ms); }

  /**
   * Gibt die seit der letzten Ausgabe verstrichene Zeit in 10-ms-Schritten aus (verschraenkt in out, Format rate()
   * und kanaele()), hoechstens kAusgabeHoechstensMs; was darueber verstrichen ist, zaehlt in mixDropsMs.
   * Rueckgabe: Abtastwerte je Kanal; 0 vor dem Beginn.
   */
  int ausgabe(int64_t jetzt, std::vector<int16_t>& out) {
    out.clear();
    if (!laeuft_ || jetzt <= uhr_) return 0;
    if (jetzt - uhr_ > kAusgabeHoechstensMs) {   // Haenger der Hauptschleife: Uhr nachziehen, Rest verworfen
      dropsMs_ += jetzt - kAusgabeHoechstensMs - uhr_;
      uhr_ = jetzt - kAusgabeHoechstensMs;
    }
    const int64_t schritte = (jetzt - uhr_) / kSchrittMs;
    if (schritte <= 0) return 0;
    uhr_ += schritte * kSchrittMs;
    const bool nurB = rateMismatch();
    const Eingang& f = nurB || b_.rate > 0 ? b_ : a_;   // Format der Ausgabe
    if (f.rate <= 0 || f.kanaele <= 0) return 0;
    const int proSchritt = f.rate / 100;               // Abtastwerte je Kanal in 10 ms
    const size_t werte = static_cast<size_t>(proSchritt) * static_cast<size_t>(f.kanaele);
    std::vector<int32_t> summe(werte);
    for (int64_t s = 0; s < schritte; ++s) {
      std::fill(summe.begin(), summe.end(), 0);
      if (!nurB) nimm(a_, summe, f);
      nimm(b_, summe, f);
      for (int32_t v : summe) out.push_back(static_cast<int16_t>(std::clamp<int32_t>(v, -32768, 32767)));
    }
    return static_cast<int>(schritte) * proSchritt;
  }

  /** Rate oder Kanalzahl der beiden Eingaenge passen nicht zusammen: nur der Computerton geht hinaus. */
  bool rateMismatch() const { return a_.rate > 0 && b_.rate > 0 && (a_.rate != b_.rate || a_.kanaele != b_.kanaele); }
  int64_t mixSilenceMs() const { return stilleMs_; }
  int64_t mixDropsMs() const { return dropsMs_; }
  bool laeuft() const { return laeuft_; }
  /** Groesster Rueckstand der beiden Eingaenge in ms (nie ueber 200). */
  int64_t rueckstandMs() const { return std::max(pufferMs(a_), pufferMs(b_)); }
  int rate() const { return rateMismatch() || b_.rate > 0 ? b_.rate : a_.rate; }
  int kanaele() const { return rateMismatch() || b_.rate > 0 ? b_.kanaele : a_.kanaele; }

  /** MischerEingangBNeu (6.10 Schritt 8): neue Freigabe, Eingang B beginnt leer und ohne Format. */
  void eingangBNeu() { b_ = Eingang{}; }

 private:
  struct Eingang {
    int rate = 0;
    int kanaele = 0;
    std::deque<int16_t> puffer;
  };

  static int64_t pufferMs(const Eingang& e) {
    if (e.rate <= 0 || e.kanaele <= 0) return 0;
    return static_cast<int64_t>(e.puffer.size()) / e.kanaele * 1000 / e.rate;
  }

  void eingang(Eingang& e, const int16_t* abtast, int n, int rate, int kanaele, int64_t ms) {
    if (abtast == nullptr || n <= 0 || rate <= 0 || kanaele <= 0) return;
    if (e.rate != rate || e.kanaele != kanaele) {   // Formatwechsel: der alte Rest passt nicht mehr
      e.puffer.clear();
      e.rate = rate;
      e.kanaele = kanaele;
    }
    e.puffer.insert(e.puffer.end(), abtast, abtast + static_cast<size_t>(n) * static_cast<size_t>(kanaele));
    const size_t grenze = static_cast<size_t>(static_cast<int64_t>(rate) * kRueckstandMs / 1000) * static_cast<size_t>(kanaele);
    if (e.puffer.size() > grenze) {
      const size_t zuViel = e.puffer.size() - grenze;
      e.puffer.erase(e.puffer.begin(), e.puffer.begin() + static_cast<std::ptrdiff_t>(zuViel));
      dropsMs_ += static_cast<int64_t>(zuViel) / kanaele * 1000 / rate;
    }
    const size_t vorlauf = static_cast<size_t>(static_cast<int64_t>(rate) * kVorlaufMs / 1000) * static_cast<size_t>(kanaele);
    if (!laeuft_ && e.puffer.size() >= vorlauf) {
      laeuft_ = true;
      uhr_ = ms;
    }
  }

  /** 10 ms dieses Eingangs in die Summe; was fehlt, bleibt Stille und zaehlt in mixSilenceMs. */
  void nimm(Eingang& e, std::vector<int32_t>& summe, const Eingang& format) {
    const size_t gewollt = summe.size();
    const size_t da = e.puffer.size() < gewollt ? e.puffer.size() : gewollt;
    for (size_t i = 0; i < da; ++i) summe[i] += e.puffer[i];
    e.puffer.erase(e.puffer.begin(), e.puffer.begin() + static_cast<std::ptrdiff_t>(da));
    if (da < gewollt) stilleMs_ += static_cast<int64_t>(gewollt - da) / format.kanaele * 1000 / format.rate;
  }

  Eingang a_;
  Eingang b_;
  bool laeuft_ = false;
  int64_t uhr_ = 0;
  int64_t stilleMs_ = 0;
  int64_t dropsMs_ = 0;
};

}  // namespace slotlogic
