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

// ---- Bildschirmfreigabe (Spec 6.9, E20; Task A5) --------------------------------------------------------

// Werte der Aufzaehlungen im Zoom-Header 7.1.5.43953, Index = Wert (zoom_sdk_def.h:561-585 SharingStatus,
// :420-444 ShareType; A-EP4). Eigene Namen, damit sie in video.cpp neben den SDK-Namen nicht kollidieren.
inline constexpr int STATUS_EIGEN_BEGINN = 0;         // Sharing_Self_Send_Begin
inline constexpr int STATUS_EIGEN_ENDE = 1;           // Sharing_Self_Send_End
inline constexpr int STATUS_EIGEN_TON_BEGINN = 2;     // Sharing_Self_Send_Pure_Audio_Begin
inline constexpr int STATUS_EIGEN_TON_ENDE = 3;       // Sharing_Self_Send_Pure_Audio_End
inline constexpr int STATUS_FREMD_BEGINN = 4;         // Sharing_Other_Share_Begin
inline constexpr int STATUS_FREMD_ENDE = 5;           // Sharing_Other_Share_End
inline constexpr int STATUS_FREMD_TON_BEGINN = 6;     // Sharing_Other_Share_Pure_Audio_Begin
inline constexpr int STATUS_FREMD_TON_ENDE = 7;       // Sharing_Other_Share_Pure_Audio_End
inline constexpr int STATUS_ANSICHT_FREMD = 8;        // Sharing_View_Other_Sharing
inline constexpr int STATUS_PAUSE = 9;                // Sharing_Pause
inline constexpr int STATUS_WEITER = 10;              // Sharing_Resume
inline constexpr int TYP_UNBEKANNT = 0;               // SHARE_TYPE_UNKNOWN (bei Begin oft vorlaeufig)
inline constexpr int TYP_COMPUTERTON = 10;            // SHARE_TYPE_COMPUTER_AUDIO

inline constexpr const char* SHARE_TYP_NAMEN[11] = {
  "unknown", "as", "ds", "wb", "airhost", "camera", "data", "videoFile", "frame", "document", "computerAudio"
};
inline constexpr const char* SHARING_STATUS_NAMEN[11] = {
  "selfSendBegin", "selfSendEnd", "selfSendPureAudioBegin", "selfSendPureAudioEnd", "otherShareBegin",
  "otherShareEnd", "otherSharePureAudioBegin", "otherSharePureAudioEnd", "viewOtherSharing", "pause", "resume"
};

/** Typ als Name fuer shares/recent; ein Wert ausserhalb des Headers heisst „unknown“. */
inline const char* shareTypName(int typ) { return typ >= 0 && typ <= TYP_COMPUTERTON ? SHARE_TYP_NAMEN[typ] : "unknown"; }
/** Status als Name fuer recent; nullptr fuer einen Wert ausserhalb des Headers (dann meldet die Bridge ihn nicht). */
inline const char* sharingStatusName(int s) { return s >= 0 && s <= STATUS_WEITER ? SHARING_STATUS_NAMEN[s] : nullptr; }

/** Ein Eintrag der Liste (6.9): {share, user, status, type, audioOnly, seq, pauses}; status = paused/running. */
struct FreigabeEintrag {
  unsigned share = 0;
  unsigned user = 0;
  bool paused = false;
  uint8_t type = 0;
  bool audioOnly = false;
  uint64_t seq = 0;
  int pauses = 0;
};

/** Ergebnis eines Befuellens, als shares.seeded: „ok“, „empty“, „unavailable“ (6.3). */
enum class Befuellt : uint8_t { Ok, Leer, NichtVerfuegbar };
inline constexpr const char* BEFUELLT_NAMEN[3] = {"ok", "empty", "unavailable"};
inline const char* name(Befuellt v) { return BEFUELLT_NAMEN[static_cast<int>(v)]; }

/**
 * Die Liste der Freigaben, eine je Bridge; alle Freigabe-Slots zeigen dieselbe gezeigte Freigabe (E20, O3).
 * Gefuettert aus den Merkern des ShareListener (6.5) in der Hauptschleife. Gezeigt wird der Eintrag mit dem
 * hoechsten seq, der nicht audioOnly ist (laufend oder pausiert). Pause aendert nichts am Abo.
 */
class FreigabeListe {
 public:
  /** Ein onSharingStatus (Tabelle 6.9). true = die Liste hat sich geaendert. */
  bool status(int sharingStatus, unsigned user, unsigned share, int contentType) {
    switch (sharingStatus) {
      case STATUS_FREMD_BEGINN: return beginn(user, share, contentType, false);
      case STATUS_FREMD_TON_BEGINN: return beginn(user, share, contentType, true);
      case STATUS_FREMD_ENDE: return ende(user, share, false);
      case STATUS_FREMD_TON_ENDE: return ende(user, share, true);
      case STATUS_PAUSE: return pause(user, share, true);
      case STATUS_WEITER: return pause(user, share, false);
      default: return false;   // Sharing_Self_*, Sharing_View_Other_Sharing: wir teilen nie (nur stderr)
    }
  }

  /**
   * Typ-Nachtrag (onShareContentNotification, B37): Typ des passenden Eintrags (gleiche Person und Kennung, sonst
   * der Eintrag dieser Person mit Kennung 0, dessen Kennung nachgezogen wird) OHNE neues seq; COMPUTER_AUDIO
   * setzt audioOnly. Ohne passenden Eintrag nichts.
   */
  bool typNachtrag(unsigned user, unsigned share, int contentType) {
    FreigabeEintrag* e = finde(user, share);
    bool geaendert = false;
    if (e == nullptr && share != 0) {
      e = finde(user, 0);
      if (e != nullptr) {
        e->share = share;   // Kennung nachgezogen (AN19)
        geaendert = true;
      }
    }
    if (e == nullptr) return false;
    const uint8_t t = typ(contentType);
    if (e->type != t) {
      e->type = t;
      geaendert = true;
    }
    if (contentType == TYP_COMPUTERTON && !e->audioOnly) {
      e->audioOnly = true;
      geaendert = true;
    }
    return geaendert;
  }

  /** Weggang einer Person (Merker): ihre Eintraege fallen weg, auch ohne Share_End (Annahme AN9). */
  bool weggang(unsigned user) {
    const size_t vorher = eintraege_.size();
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user](const FreigabeEintrag& e) { return e.user == user; }),
                     eintraege_.end());
    return eintraege_.size() != vorher;
  }

  void leeren() { eintraege_.clear(); }

  /**
   * Befuellen aus GetViewableSharingUserList/GetSharingSourceInfoList (6.9, B38). nurErgaenzen = false heisst
   * INMEETING: zuerst leeren (Kennungen wechseln), auch wenn Zoom nichts liefert. nurErgaenzen = true heisst
   * erstes Einschalten eines Freigabe-Slots: Bekanntes bleibt mit seinem seq. Fehlende Eintraege bekommen ein seq
   * UNTER allen per Rueckruf bekannten, untereinander in Listenreihenfolge (Annahme AN20). nullptr = nicht
   * verfuegbar, leere Liste = leer; beides loescht nie einen bekannten Eintrag.
   */
  Befuellt befuellen(const std::vector<FreigabeEintrag>* zoomListe, bool nurErgaenzen) {
    if (!nurErgaenzen) leeren();
    if (zoomListe == nullptr) return Befuellt::NichtVerfuegbar;
    if (zoomListe->empty()) return Befuellt::Leer;
    for (const FreigabeEintrag& z : *zoomListe) {
      if (finde(z.user, z.share) != nullptr) continue;
      FreigabeEintrag* nullEintrag = z.share != 0 ? finde(z.user, 0) : nullptr;
      if (nullEintrag != nullptr) {        // per Rueckruf mit Kennung 0 bekannt: Kennung nachziehen, seq bleibt
        nullEintrag->share = z.share;
        continue;
      }
      FreigabeEintrag e = z;
      e.seq = ++befuelltSeq_;
      if (e.type == TYP_COMPUTERTON) e.audioOnly = true;
      eintraege_.push_back(e);
    }
    return Befuellt::Ok;
  }

  /** Die gezeigte Freigabe: hoechstes seq ohne audioOnly; nullptr = keine. */
  const FreigabeEintrag* gezeigt() const {
    const FreigabeEintrag* beste = nullptr;
    for (const FreigabeEintrag& e : eintraege_) {
      if (e.audioOnly) continue;
      if (beste == nullptr || e.seq > beste->seq) beste = &e;
    }
    return beste;
  }

  const std::vector<FreigabeEintrag>& eintraege() const { return eintraege_; }

  /** Zahl der Bild-Freigaben (ohne reine Ton-Freigaben). */
  int bildFreigaben() const {
    int n = 0;
    for (const FreigabeEintrag& e : eintraege_) {
      if (!e.audioOnly) ++n;
    }
    return n;
  }

 private:
  /** Rueckruf-seq beginnt ueber allen Befuell-seq: Befuellte begannen vor dem Ankommen (AN20). */
  static constexpr uint64_t kRueckrufBasis = uint64_t{1} << 32;

  static uint8_t typ(int contentType) {
    return static_cast<uint8_t>(contentType >= 0 && contentType <= TYP_COMPUTERTON ? contentType : TYP_UNBEKANNT);
  }

  FreigabeEintrag* finde(unsigned user, unsigned share) {
    for (FreigabeEintrag& e : eintraege_) {
      if (e.user == user && e.share == share) return &e;
    }
    return nullptr;
  }

  /** Begin: Eintrag mit neuem seq; ein erneuter Begin derselben Freigabe ersetzt den alten (Entscheidung E-a2-3). */
  bool beginn(unsigned user, unsigned share, int contentType, bool tonAllein) {
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user, share](const FreigabeEintrag& e) { return e.user == user && e.share == share; }),
                     eintraege_.end());
    FreigabeEintrag e;
    e.user = user;
    e.share = share;
    e.type = typ(contentType);
    e.audioOnly = tonAllein || contentType == TYP_COMPUTERTON;
    e.seq = ++rueckrufSeq_;
    eintraege_.push_back(e);
    return true;
  }

  /** End: Eintrag entfernen; Kennung 0 gilt fuer alle Eintraege der Person (Entscheidung E-a2-3, wie AN8). */
  bool ende(unsigned user, unsigned share, bool nurTon) {
    const size_t vorher = eintraege_.size();
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user, share, nurTon](const FreigabeEintrag& e) {
                                      return e.user == user && (share == 0 || e.share == share) && (!nurTon || e.audioOnly);
                                    }),
                     eintraege_.end());
    return eintraege_.size() != vorher;
  }

  /** Pause/Resume: paused bzw. running, pauses zaehlt; Kennung 0 gilt fuer alle Eintraege der Person (AN8). */
  bool pause(unsigned user, unsigned share, bool an) {
    bool geaendert = false;
    for (FreigabeEintrag& e : eintraege_) {
      if (e.user != user || (share != 0 && e.share != share) || e.paused == an) continue;
      e.paused = an;
      if (an) ++e.pauses;
      geaendert = true;
    }
    return geaendert;
  }

  std::vector<FreigabeEintrag> eintraege_;
  uint64_t rueckrufSeq_ = kRueckrufBasis;
  uint64_t befuelltSeq_ = 0;
};

}  // namespace slotlogic
