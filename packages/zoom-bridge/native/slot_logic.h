#pragma once
// Entscheidungslogik der Zoom-Slots (Connect 0.4.0, Spec 6.1 und 6.8-6.15).
//
// REINE LOGIK: nur die C++-Standardbibliothek, kein Zoom-, NDI- oder Windows-Header (G-A2; ein
// Quelltext-Waechter in test/selftest.ts prueft die Einbindungen). Jede Zeit kommt als int64_t in
// Millisekunden von aussen (Muster delay_line.h:19-27). Darum laeuft native/slot_logic_test.cpp ohne
// Meeting, ohne SDK und auch unter Linux (npm run logik-test, CI-Job selftests).
//
// Die Aufzaehlungen folgen in Reihenfolge und Schreibweise den Katalogen in src/protocol.ts; jede hat eine
// Namens-Tabelle gleicher Laenge. test/selftest.ts gleicht Aufzaehlung, Tabelle und Katalog ab (A-EP10).
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace slotlogic {

// ---- Aufzaehlungen und Namen (Gliederung 3.1; Task A4) ----------------------------------------------------

enum class SlotMode : uint8_t { Participant, Speaker, Share };                     // SLOT_MODES
enum class Fallback : uint8_t { Transparent, Freeze, Black, White };               // SLOT_FALLBACKS
enum class SlotAudio : uint8_t { Off, Mix, Person };                               // SLOT_AUDIO_SETTINGS
enum class Sent : uint8_t { None, Transparent, Freeze, Black, White, Held };       // SLOT_SENT
enum class SlotState : uint8_t { Starting, Live, Fallback, Held, Off };            // SLOT_STATES
enum class Grund : uint8_t {                                                       // SLOT_REASONS (20)
  command, frames, noTarget, participantLeft, cameraOff, noFrames, speakerNone, speakerNoVideo,
  speakerChanged, shareNone, sharePaused, shareStill, shareChanged, targetChanged, modeChanged,
  resolutionChanged, bufferMismatch, subscribeFailed, meetingEnded, privilegeRevoked
};
enum class TonGrund : uint8_t {                                                    // SLOT_AUDIO_REASONS (12)
  command, packets, gap, audioUnavailable, participantLeft, personNotInMode, noShare, rateMismatch,
  targetChanged, modeChanged, meetingEnded, privilegeRevoked
};
enum class TonQuelle : uint8_t { Mix, Person, Share, MixShare, None };             // SLOT_AUDIO_SOURCES
enum class TonZustand : uint8_t { Waiting, Live, Silent, Off };                    // AUDIO_STATES
enum class Signal : uint8_t { SpeakerVideo, ActiveVideo, ActiveAudio };            // SPEAKER_SIGNALS

inline constexpr const char* MODUS_NAMEN[3] = {"participant", "speaker", "share"};
inline constexpr const char* FALLBACK_NAMEN[4] = {"transparent", "freeze", "black", "white"};
inline constexpr const char* AUDIO_NAMEN[3] = {"off", "mix", "person"};
inline constexpr const char* SENT_NAMEN[6] = {"none", "transparent", "freeze", "black", "white", "held"};
inline constexpr const char* ZUSTAND_NAMEN[5] = {"starting", "live", "fallback", "held", "off"};
inline constexpr const char* GRUND_NAMEN[20] = {
  "command", "frames", "noTarget", "participantLeft", "cameraOff", "noFrames", "speakerNone", "speakerNoVideo",
  "speakerChanged", "shareNone", "sharePaused", "shareStill", "shareChanged", "targetChanged", "modeChanged",
  "resolutionChanged", "bufferMismatch", "subscribeFailed", "meetingEnded", "privilegeRevoked"
};
inline constexpr const char* TONGRUND_NAMEN[12] = {
  "command", "packets", "gap", "audioUnavailable", "participantLeft", "personNotInMode", "noShare", "rateMismatch",
  "targetChanged", "modeChanged", "meetingEnded", "privilegeRevoked"
};
inline constexpr const char* TONQUELLE_NAMEN[5] = {"mix", "person", "share", "mixShare", "none"};
inline constexpr const char* TONZUSTAND_NAMEN[4] = {"waiting", "live", "silent", "off"};
inline constexpr const char* SIGNAL_NAMEN[3] = {"speakerVideo", "activeVideo", "activeAudio"};

// Jede Tabelle hat genau so viele Eintraege, wie ihre Aufzaehlung Werte hat (der letzte Wert + 1).
static_assert(static_cast<int>(SlotMode::Share) + 1 == 3, "MODUS_NAMEN");
static_assert(static_cast<int>(Fallback::White) + 1 == 4, "FALLBACK_NAMEN");
static_assert(static_cast<int>(SlotAudio::Person) + 1 == 3, "AUDIO_NAMEN");
static_assert(static_cast<int>(Sent::Held) + 1 == 6, "SENT_NAMEN");
static_assert(static_cast<int>(SlotState::Off) + 1 == 5, "ZUSTAND_NAMEN");
static_assert(static_cast<int>(Grund::privilegeRevoked) + 1 == 20, "GRUND_NAMEN");
static_assert(static_cast<int>(TonGrund::privilegeRevoked) + 1 == 12, "TONGRUND_NAMEN");
static_assert(static_cast<int>(TonQuelle::None) + 1 == 5, "TONQUELLE_NAMEN");
static_assert(static_cast<int>(TonZustand::Off) + 1 == 4, "TONZUSTAND_NAMEN");
static_assert(static_cast<int>(Signal::ActiveAudio) + 1 == 3, "SIGNAL_NAMEN");

inline const char* name(SlotMode v) { return MODUS_NAMEN[static_cast<int>(v)]; }
inline const char* name(Fallback v) { return FALLBACK_NAMEN[static_cast<int>(v)]; }
inline const char* name(SlotAudio v) { return AUDIO_NAMEN[static_cast<int>(v)]; }
inline const char* name(Sent v) { return SENT_NAMEN[static_cast<int>(v)]; }
inline const char* name(SlotState v) { return ZUSTAND_NAMEN[static_cast<int>(v)]; }
inline const char* name(Grund v) { return GRUND_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonGrund v) { return TONGRUND_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonQuelle v) { return TONQUELLE_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonZustand v) { return TONZUSTAND_NAMEN[static_cast<int>(v)]; }
inline const char* name(Signal v) { return SIGNAL_NAMEN[static_cast<int>(v)]; }

// ---- Aktiver Sprecher (Spec 6.8, E19; Task A4) -----------------------------------------------------------

/** „Hat Kamera an“ fuer eine Kennung; die Hauptschleife fragt IUserInfo::IsVideoOn() (6.8 Regel 3). */
using KameraAn = std::function<bool(unsigned id)>;

/**
 * Eine je Bridge. Haelt je Signal das zuletzt gemeldete Ergebnis mit Zeit (speakerVideo/activeVideo: die
 * Kennung, activeAudio: die Liste). Gefuettert von JEDEM Signal, auch ohne Sprecher-Slot: die Rueckrufe melden
 * nur Wechsel, und einen Getter fuer den aktuellen Sprecher gibt es nicht (6.8).
 * Leeren bei INMEETING, Meeting-Ende, leave, quit und EOF, NICHT beim Entzug (Kennungen gelten weiter).
 */
class SprecherErinnerung {
 public:
  /** Eine leere Liste aendert nichts (6.8 Regel 2; Entscheidung E-a2-1): sie traegt keinen Sprecher. */
  void melde(Signal s, const std::vector<unsigned>& ids, int64_t ms) {
    if (ids.empty()) return;
    Eintrag& e = eintraege_[static_cast<size_t>(s)];
    e.da = true;
    e.ids = ids;
    e.ms = ms;
  }

  /** Weggang: die Erinnerung verliert die Kennung; ein Eintrag ohne Kennung faellt weg. */
  void entferne(unsigned id) {
    for (Eintrag& e : eintraege_) {
      if (!e.da) continue;
      e.ids.erase(std::remove(e.ids.begin(), e.ids.end(), id), e.ids.end());
      if (e.ids.empty()) e = Eintrag{};
    }
  }

  void leeren() {
    for (Eintrag& e : eintraege_) e = Eintrag{};
  }

  /** nullptr = kein Eintrag fuer dieses Signal. */
  const std::vector<unsigned>* letzte(Signal s) const {
    const Eintrag& e = eintraege_[static_cast<size_t>(s)];
    return e.da ? &e.ids : nullptr;
  }

  /** Zeit des letzten Eintrags (Bridge-Uhr, ms); 0 ohne Eintrag. */
  int64_t letzteMs(Signal s) const {
    const Eintrag& e = eintraege_[static_cast<size_t>(s)];
    return e.da ? e.ms : 0;
  }

 private:
  struct Eintrag {
    bool da = false;
    std::vector<unsigned> ids;
    int64_t ms = 0;
  };
  Eintrag eintraege_[3];
};

/** Einstellung aus speakerConfig und dem Slot (E19: Vorgabe speakerVideo, 1000 ms; showNoVideo je Slot). */
struct SprecherEinstellung {
  Signal signal = Signal::SpeakerVideo;
  int64_t haltezeitMs = 1000;
  bool showNoVideo = true;
};

/**
 * Ergebnis eines Schritts. wechsel = der Slot haengt um (slotRetarget(VIDEO, ziel, grund), 6.8 Regel 5/6).
 * ziel ist das gezeigte Ziel nach dem Schritt (0 = keins). grund gilt nur bei wechsel: speakerChanged bzw.
 * speakerNone (Ziel 0). Ohne wechsel steht grund auf command und bedeutet nichts.
 */
struct SprecherSchritt {
  bool wechsel = false;
  unsigned ziel = 0;
  Grund grund = Grund::command;
};

/**
 * Eine je Sprecher-Slot (6.8 Regeln 1-8). Jede neue SprecherWahl (Einschalten, Moduswechsel auf Sprecher,
 * Wechsel des Signals) wird mit vorbelegen() aus der Erinnerung des gewaehlten Signals vorbelegt.
 */
class SprecherWahl {
 public:
  SprecherWahl(SprecherEinstellung e, unsigned eigeneId) : e_(e), eigene_(eigeneId) {}

  /**
   * Regel 4 und 8: Ziel sofort aus der Erinnerung (dieselben Kandidaten-Regeln 2 und 3), ohne Haltezeit; ohne
   * Eintrag Ziel 0 mit speakerNone. jetzt bleibt im Vertrag (Gliederung), die Vorbelegung braucht keine Zeit.
   */
  SprecherSchritt vorbelegen(const SprecherErinnerung& er, const KameraAn& kamera, int64_t /*jetzt*/) {
    const std::vector<unsigned>* ids = er.letzte(e_.signal);
    const unsigned k = ids != nullptr ? kandidat(*ids, kamera) : 0;
    haengend_ = false;
    ziel_ = k;
    if (k == 0) return {false, 0, Grund::speakerNone};
    return {true, k, Grund::speakerChanged};
  }

  /** Ein Rueckruf eines der drei Signale; nur das gewaehlte steuert (Regel 1). */
  SprecherSchritt signal(Signal s, const std::vector<unsigned>& ids, const KameraAn& kamera, int64_t jetzt) {
    if (s != e_.signal) return keinWechsel();
    const unsigned k = kandidat(ids, kamera);
    if (k == 0) return keinWechsel();                    // leere Liste, 0, eigene Kennung, uebersprungen
    if (ziel_ == 0) return wechselAuf(k);                // Regel 4: ohne Ziel sofort
    if (k == ziel_) {                                    // der Gezeigte ist wieder Kandidat: Wechsel verfaellt
      haengend_ = false;
      return keinWechsel();
    }
    if (!haengend_ || kandidat_ != k) {                  // jeder andere Kandidat startet die Zeit neu
      haengend_ = true;
      kandidat_ = k;
      seit_ = jetzt;
    }
    return haltezeitPruefen(jetzt);
  }

  /** Aus slotLogicTick (6.6 Nr. 5): abgelaufene Haltezeit; Regel 3 gilt auch waehrend der Haltezeit. */
  SprecherSchritt tick(const KameraAn& kamera, int64_t jetzt) {
    if (!haengend_) return keinWechsel();
    if (!e_.showNoVideo && !kamera(kandidat_)) {
      haengend_ = false;
      return keinWechsel();
    }
    return haltezeitPruefen(jetzt);
  }

  /** Regel 6: geht der gezeigte Sprecher, Ziel 0 mit speakerNone; der naechste Kandidat kommt dann sofort. */
  SprecherSchritt weggang(unsigned id, int64_t /*jetzt*/) {
    if (haengend_ && kandidat_ == id) haengend_ = false;
    if (id == 0 || id != ziel_) return keinWechsel();
    ziel_ = 0;
    haengend_ = false;
    return {true, 0, Grund::speakerNone};
  }

  unsigned ziel() const { return ziel_; }

 private:
  /** Regel 2 und 3. activeAudio: die erste Kennung der Liste, die Kandidat sein darf (Entscheidung E-a2-2). */
  unsigned kandidat(const std::vector<unsigned>& ids, const KameraAn& kamera) const {
    if (e_.signal == Signal::ActiveAudio) {
      for (unsigned id : ids) {
        if (darfKandidatSein(id, kamera)) return id;
      }
      return 0;
    }
    return !ids.empty() && darfKandidatSein(ids.front(), kamera) ? ids.front() : 0;
  }

  bool darfKandidatSein(unsigned id, const KameraAn& kamera) const {
    if (id == 0 || id == eigene_) return false;          // Kennung 0 und die eigene Kennung nie (Regel 2)
    return e_.showNoVideo || kamera(id);                 // Regel 3
  }

  SprecherSchritt haltezeitPruefen(int64_t jetzt) {
    if (jetzt - seit_ >= e_.haltezeitMs) return wechselAuf(kandidat_);   // Regel 4: die Haltezeit lang, >=
    return keinWechsel();
  }

  SprecherSchritt wechselAuf(unsigned k) {
    ziel_ = k;
    haengend_ = false;
    return {true, k, Grund::speakerChanged};
  }

  SprecherSchritt keinWechsel() const { return {false, ziel_, Grund::command}; }

  SprecherEinstellung e_;
  unsigned eigene_ = 0;
  unsigned ziel_ = 0;
  bool haengend_ = false;
  unsigned kandidat_ = 0;
  int64_t seit_ = 0;
};

}  // namespace slotlogic
