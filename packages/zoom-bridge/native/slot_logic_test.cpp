// Selbsttest der Entscheidungslogik der Zoom-Slots (slot_logic.h, Spec 11.1) - OHNE Zoom, OHNE NDI, OHNE
// Uhr: jede Zeit wird eingespeist. Laeuft darum unter Windows und Linux, auch in der CI.
//
//   npm run logik-test -w @jm/zoom-bridge     (Compiler direkt, auch CI)
//   npm run slot-test -w @jm/zoom-bridge      (lokal ueber CMake, braucht beide SDKs)
//
// Aufbau wie delay_line_test.cpp: Makro CHECK, eingespeiste Zeit at(ms), je Fall eine Funktion mit
// gedrucktem Titel, Aufruf in main(). Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "slot_logic.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace {

using namespace slotlogic;

int g_run = 0;
int g_fail = 0;

#define CHECK(cond)                                                          \
  do {                                                                       \
    ++g_run;                                                                 \
    if (!(cond)) {                                                           \
      ++g_fail;                                                              \
      std::printf("  FEHLER %s:%d: %s\n", __FILE__, __LINE__, #cond);        \
    }                                                                        \
  } while (0)

/** Eingespeiste Bridge-Uhr in Millisekunden (Muster delay_line_test.cpp:29). */
int64_t at(int ms) { return static_cast<int64_t>(ms); }

bool gleich(const char* a, const char* b) { return std::strcmp(a, b) == 0; }

// Kennungen wie in den Attrappen-Namen (A-EP22); EIGENE ist die Bridge selbst.
constexpr unsigned EIGENE = 16778200;
constexpr unsigned A = 16778240;
constexpr unsigned B = 16778241;
constexpr unsigned C = 16778242;

bool alleKameraAn(unsigned) { return true; }
const KameraAn KAMERA_AN = alleKameraAn;
/** Kamera an fuer alle ausser `aus`. */
KameraAn ohneKamera(unsigned aus) {
  return [aus](unsigned id) { return id != aus; };
}

SprecherEinstellung einstellung(Signal s, int64_t haltezeitMs, bool showNoVideo) {
  SprecherEinstellung e;
  e.signal = s;
  e.haltezeitMs = haltezeitMs;
  e.showNoVideo = showNoVideo;
  return e;
}

void a4_namen() {
  std::printf("A4 Namen: jede Aufzaehlung findet ihren Namen am eigenen Index\n");
  CHECK(gleich(name(SlotMode::Speaker), "speaker"));
  CHECK(gleich(name(Fallback::White), "white"));
  CHECK(gleich(name(SlotAudio::Person), "person"));
  CHECK(gleich(name(Sent::Held), "held"));
  CHECK(gleich(name(SlotState::Fallback), "fallback"));
  CHECK(gleich(name(Grund::noFrames), "noFrames"));
  CHECK(gleich(name(Grund::privilegeRevoked), "privilegeRevoked"));
  CHECK(gleich(name(TonGrund::personNotInMode), "personNotInMode"));
  CHECK(gleich(name(TonQuelle::MixShare), "mixShare"));
  CHECK(gleich(name(TonZustand::Silent), "silent"));
  CHECK(gleich(name(Signal::ActiveAudio), "activeAudio"));
}

void pb1_haltezeit_genau() {
  std::printf("PB1 Sprecher: Kandidat B neben gezeigtem A wechselt bei 999 ms nicht, bei 1000 ms schon\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  CHECK(s.wechsel && s.ziel == A);
  s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1000));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(1999));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2000));
  CHECK(s.wechsel && s.ziel == B && s.grund == Grund::speakerChanged);
  CHECK(w.ziel() == B);
}

void pb2_neuer_kandidat_startet_neu() {
  std::printf("PB2 Sprecher: B (0 ms), C (400 ms), B (800 ms) - kein Wechsel vor 1800 ms\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1000));
  w.signal(Signal::SpeakerVideo, {C}, KAMERA_AN, at(1400));
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1800));
  CHECK(!s.wechsel);
  s = w.tick(KAMERA_AN, at(2000));   // 1000 ms nach dem ersten B: die Zeit lief neu
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2400));   // 1000 ms nach C: C ist nicht mehr Kandidat
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2799));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2800));
  CHECK(s.wechsel && s.ziel == B);
}

void pb3_ohne_ziel_sofort() {
  std::printf("PB3 Sprecher: ohne Ziel wechselt das erste Signal sofort, ohne Haltezeit\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 5000, true), EIGENE);
  CHECK(w.ziel() == 0);
  const SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(10));
  CHECK(s.wechsel && s.ziel == B && s.grund == Grund::speakerChanged);
}

void pb4_eigene_und_null_nie() {
  std::printf("PB4 Sprecher: eigene Kennung und Kennung 0 nie Kandidat, je Signal, auch nicht als Vorbelegung\n");
  const Signal alle[3] = {Signal::SpeakerVideo, Signal::ActiveVideo, Signal::ActiveAudio};
  for (Signal sig : alle) {
    SprecherWahl w(einstellung(sig, 0, true), EIGENE);
    SprecherSchritt s = w.signal(sig, {EIGENE}, KAMERA_AN, at(0));
    CHECK(!s.wechsel && w.ziel() == 0);
    s = w.signal(sig, {0}, KAMERA_AN, at(10));
    CHECK(!s.wechsel && w.ziel() == 0);
    SprecherErinnerung er;
    er.melde(sig, {EIGENE}, at(20));
    SprecherWahl v1(einstellung(sig, 0, true), EIGENE);
    s = v1.vorbelegen(er, KAMERA_AN, at(30));
    CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
    er.melde(sig, {0}, at(40));
    SprecherWahl v2(einstellung(sig, 0, true), EIGENE);
    s = v2.vorbelegen(er, KAMERA_AN, at(50));
    CHECK(!s.wechsel && v2.ziel() == 0);
  }
  SprecherWahl audio(einstellung(Signal::ActiveAudio, 0, true), EIGENE);
  const SprecherSchritt s = audio.signal(Signal::ActiveAudio, {EIGENE, 0}, KAMERA_AN, at(60));
  CHECK(!s.wechsel && audio.ziel() == 0);
}

void pb5_aktives_audio_liste() {
  std::printf("PB5 Sprecher: activeAudio [eigene, 7, 9] -> 7; danach [] aendert nichts\n");
  SprecherWahl w(einstellung(Signal::ActiveAudio, 1000, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::ActiveAudio, {EIGENE, 7, 9}, KAMERA_AN, at(0));
  CHECK(s.wechsel && s.ziel == 7);
  s = w.signal(Signal::ActiveAudio, {}, KAMERA_AN, at(100));
  CHECK(!s.wechsel && w.ziel() == 7);
  s = w.tick(KAMERA_AN, at(5000));
  CHECK(!s.wechsel && w.ziel() == 7);
  SprecherErinnerung er;
  er.melde(Signal::ActiveAudio, {EIGENE, 7, 9}, at(0));
  er.melde(Signal::ActiveAudio, {}, at(100));
  CHECK(er.letzte(Signal::ActiveAudio) != nullptr && er.letzte(Signal::ActiveAudio)->size() == 3);
}

void pb6_ohne_kamera() {
  std::printf("PB6 Sprecher: Kandidat ohne Kamera wird bei showNoVideo aus uebersprungen, bei an Ziel\n");
  SprecherWahl aus(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  SprecherSchritt s = aus.signal(Signal::SpeakerVideo, {B}, ohneKamera(B), at(0));
  CHECK(!s.wechsel && aus.ziel() == 0);
  SprecherWahl an(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = an.signal(Signal::SpeakerVideo, {B}, ohneKamera(B), at(0));
  CHECK(s.wechsel && s.ziel == B);
  // Waehrend der Haltezeit schaltet der Kandidat die Kamera aus: bei showNoVideo aus kein Wechsel.
  SprecherWahl halt(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  halt.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  halt.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  s = halt.tick(ohneKamera(B), at(1100));
  CHECK(!s.wechsel && halt.ziel() == A);
  // activeAudio: der erste Kandidat ohne Kamera wird uebersprungen, der naechste gilt (E-a2-2).
  SprecherWahl liste(einstellung(Signal::ActiveAudio, 1000, false), EIGENE);
  s = liste.signal(Signal::ActiveAudio, {B, C}, ohneKamera(B), at(0));
  CHECK(s.wechsel && s.ziel == C);
}

void pb7_nur_gewaehltes_signal() {
  std::printf("PB7 Sprecher: activeVideo gewaehlt, nur speakerVideo kommt -> kein Wechsel\n");
  SprecherWahl w(einstellung(Signal::ActiveVideo, 0, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(0));
  CHECK(!s.wechsel && w.ziel() == 0);
  s = w.signal(Signal::ActiveAudio, {B}, KAMERA_AN, at(10));
  CHECK(!s.wechsel && w.ziel() == 0);
  s = w.signal(Signal::ActiveVideo, {B}, KAMERA_AN, at(20));
  CHECK(s.wechsel && s.ziel == B);
}

void pb8_gezeigter_geht() {
  std::printf("PB8 Sprecher: gezeigter geht -> Ziel 0 (speakerNone), naechster sofort, Erinnerung ohne ihn\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  SprecherSchritt s = w.weggang(B, at(50));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.weggang(A, at(100));
  CHECK(s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  s = w.signal(Signal::SpeakerVideo, {C}, KAMERA_AN, at(150));
  CHECK(s.wechsel && s.ziel == C);
  SprecherErinnerung er;
  er.melde(Signal::SpeakerVideo, {A}, at(0));
  er.melde(Signal::ActiveAudio, {A, C}, at(0));
  er.entferne(A);
  CHECK(er.letzte(Signal::SpeakerVideo) == nullptr);
  CHECK(er.letzte(Signal::ActiveAudio) != nullptr && *er.letzte(Signal::ActiveAudio) == std::vector<unsigned>{C});
  // Geht der wartende Kandidat, verfaellt sein Wechsel.
  SprecherWahl k(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  k.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  k.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  k.weggang(B, at(200));
  s = k.tick(KAMERA_AN, at(1100));
  CHECK(!s.wechsel && k.ziel() == A);
}

void pb9_haltezeit_grenzen() {
  std::printf("PB9 Sprecher: Haltezeit 0 wechselt sofort, 5000 erst nach 5000 ms\n");
  SprecherWahl null(einstellung(Signal::SpeakerVideo, 0, true), EIGENE);
  null.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  SprecherSchritt s = null.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(10));
  CHECK(s.wechsel && s.ziel == B);
  SprecherWahl lang(einstellung(Signal::SpeakerVideo, 5000, true), EIGENE);
  lang.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  lang.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  s = lang.tick(KAMERA_AN, at(5099));
  CHECK(!s.wechsel && lang.ziel() == A);
  s = lang.tick(KAMERA_AN, at(5100));
  CHECK(s.wechsel && s.ziel == B);
}

void pb26_erinnerung_belegt_vor() {
  std::printf("PB26 Sprecher-Erinnerung: neue SprecherWahl vorbelegt; Moduswechsel, Entzug; INMEETING leert\n");
  SprecherErinnerung er;
  er.melde(Signal::SpeakerVideo, {B}, at(100));       // Signal kam, bevor ein Sprecher-Slot lief
  SprecherWahl ein(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  SprecherSchritt s = ein.vorbelegen(er, KAMERA_AN, at(500));
  CHECK(s.wechsel && s.ziel == B && ein.ziel() == B);
  // Moduswechsel auf Sprecher, waehrend derselbe spricht: wieder derselbe.
  SprecherWahl modus(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = modus.vorbelegen(er, KAMERA_AN, at(900));
  CHECK(s.ziel == B);
  // Entzug und Wiedererteilung leeren die Erinnerung nicht (6.8): die Vorbelegung bleibt.
  SprecherWahl nachEntzug(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = nachEntzug.vorbelegen(er, KAMERA_AN, at(5000));
  CHECK(s.ziel == B);
  CHECK(er.letzteMs(Signal::SpeakerVideo) == 100);
  // Vorbelegung nach Regel 3: ohne Kamera bei showNoVideo aus kein Ziel.
  SprecherWahl ohne(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  s = ohne.vorbelegen(er, ohneKamera(B), at(5000));
  CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  // INMEETING: Kennungen wechseln, die Erinnerung ist leer.
  er.leeren();
  SprecherWahl neu(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = neu.vorbelegen(er, KAMERA_AN, at(6000));
  CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  CHECK(er.letzte(Signal::SpeakerVideo) == nullptr && er.letzteMs(Signal::SpeakerVideo) == 0);
}

// Freigaben (Task A5). Kennungen der Personen wie oben, Freigabe-Kennungen 101, 102, 103.
constexpr unsigned F1 = 101;
constexpr unsigned F2 = 102;
constexpr unsigned F3 = 103;

unsigned gezeigteFreigabe(const FreigabeListe& l) { return l.gezeigt() != nullptr ? l.gezeigt()->share : 0; }

FreigabeEintrag zoomEintrag(unsigned user, unsigned share, int typ) {
  FreigabeEintrag e;
  e.user = user;
  e.share = share;
  e.type = static_cast<uint8_t>(typ);
  return e;
}

void a5_namen() {
  std::printf("A5 Freigabe-Namen: Status- und Typ-Werte des Headers finden ihren Namen\n");
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_FREMD_BEGINN], "otherShareBegin"));
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_FREMD_TON_ENDE], "otherSharePureAudioEnd"));
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_PAUSE], "pause"));
  CHECK(gleich(sharingStatusName(STATUS_WEITER), "resume"));
  CHECK(sharingStatusName(11) == nullptr && sharingStatusName(-1) == nullptr);
  CHECK(gleich(shareTypName(2), "ds"));
  CHECK(gleich(shareTypName(TYP_COMPUTERTON), "computerAudio"));
  CHECK(gleich(shareTypName(42), "unknown"));
  CHECK(gleich(name(Befuellt::NichtVerfuegbar), "unavailable"));
}

void pb10_ruecksprung() {
  std::printf("PB10 Freigabe: Begin A, Begin B, End B, End A -> gezeigt A, B, A, keine\n");
  FreigabeListe l;
  CHECK(l.status(STATUS_FREMD_BEGINN, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.status(STATUS_FREMD_BEGINN, B, F2, 1));
  CHECK(gezeigteFreigabe(l) == F2);
  CHECK(l.status(STATUS_FREMD_ENDE, B, F2, 1));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.status(STATUS_FREMD_ENDE, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == 0 && l.gezeigt() == nullptr);
  CHECK(l.bildFreigaben() == 0);
}

void pb11_pause() {
  std::printf("PB11 Freigabe: Pause/Resume der gezeigten; Pause mit Kennung 0 trifft alle Eintraege der Person\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  CHECK(l.status(STATUS_PAUSE, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1 && l.gezeigt()->paused && l.gezeigt()->pauses == 1);
  CHECK(!l.status(STATUS_PAUSE, A, F1, 2));   // schon pausiert: keine Aenderung, kein zweites Zaehlen
  CHECK(l.status(STATUS_WEITER, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1 && !l.gezeigt()->paused && l.gezeigt()->pauses == 1);
  l.status(STATUS_PAUSE, A, F1, 2);
  CHECK(l.gezeigt()->pauses == 2);
  FreigabeListe zwei;
  zwei.status(STATUS_FREMD_BEGINN, A, F1, 2);
  zwei.status(STATUS_FREMD_BEGINN, A, F2, 1);
  zwei.status(STATUS_FREMD_BEGINN, B, F3, 2);
  CHECK(zwei.status(STATUS_PAUSE, A, 0, 0));
  int pausiertA = 0;
  for (const FreigabeEintrag& e : zwei.eintraege()) {
    if (e.user == A && e.paused) ++pausiertA;
    if (e.user == B) CHECK(!e.paused);
  }
  CHECK(pausiertA == 2);
  CHECK(gezeigteFreigabe(zwei) == F3);
}

void pb12_tonfreigabe_nie_gezeigt() {
  std::printf("PB12 Freigabe: reine Ton-Freigabe nach einer Bild-Freigabe wird nie gezeigt\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  CHECK(l.status(STATUS_FREMD_TON_BEGINN, B, F2, TYP_COMPUTERTON));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.bildFreigaben() == 1 && l.eintraege().size() == 2);
  l.status(STATUS_FREMD_ENDE, A, F1, 2);
  CHECK(gezeigteFreigabe(l) == 0);
  CHECK(l.status(STATUS_FREMD_TON_ENDE, B, F2, TYP_COMPUTERTON));
  CHECK(l.eintraege().empty());
}

void pb13_person_geht() {
  std::printf("PB13 Freigabe: Person mit Freigabe geht -> ihre Eintraege weg, die naechstjuengere wird gezeigt\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  l.status(STATUS_FREMD_BEGINN, B, F2, 2);
  l.status(STATUS_FREMD_BEGINN, B, F3, 1);
  CHECK(gezeigteFreigabe(l) == F3);
  CHECK(l.weggang(B));
  CHECK(gezeigteFreigabe(l) == F1 && l.eintraege().size() == 1);
  CHECK(!l.weggang(C));
}

void pb14_eigene_freigaben_nichts() {
  std::printf("PB14 Freigabe: Sharing_Self_* und Sharing_View_Other_Sharing aendern nichts\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const int nichts[5] = {STATUS_EIGEN_BEGINN, STATUS_EIGEN_ENDE, STATUS_EIGEN_TON_BEGINN, STATUS_EIGEN_TON_ENDE,
                         STATUS_ANSICHT_FREMD};
  for (int s : nichts) {
    CHECK(!l.status(s, B, F2, 2));
    CHECK(!l.status(s, A, F1, 2));
  }
  CHECK(l.eintraege().size() == 1 && gezeigteFreigabe(l) == F1 && !l.gezeigt()->paused);
}

void pb15_befuellen() {
  std::printf("PB15 Freigabe: INMEETING leert und befuellt; Einschalten ergaenzt nur; empty/unavailable loescht nichts\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const std::vector<FreigabeEintrag> zoom = {zoomEintrag(B, F2, 2), zoomEintrag(C, F3, 1)};
  CHECK(l.befuellen(&zoom, false) == Befuellt::Ok);   // INMEETING
  CHECK(l.eintraege().size() == 2 && l.eintraege()[0].share == F2 && l.eintraege()[1].share == F3);
  CHECK(l.eintraege()[0].seq < l.eintraege()[1].seq);
  CHECK(gezeigteFreigabe(l) == F3);
  FreigabeListe ein;
  ein.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const uint64_t seqA = ein.gezeigt()->seq;
  const std::vector<FreigabeEintrag> zoom2 = {zoomEintrag(B, F2, 2), zoomEintrag(A, F1, 2), zoomEintrag(C, F3, 1)};
  CHECK(ein.befuellen(&zoom2, true) == Befuellt::Ok);   // erstes Einschalten
  CHECK(ein.eintraege().size() == 3);
  CHECK(gezeigteFreigabe(ein) == F1 && ein.gezeigt()->seq == seqA);
  uint64_t seqB = 0;
  uint64_t seqC = 0;
  for (const FreigabeEintrag& e : ein.eintraege()) {
    if (e.share == F2) seqB = e.seq;
    if (e.share == F3) seqC = e.seq;
  }
  CHECK(seqB < seqC && seqC < seqA);
  ein.status(STATUS_FREMD_BEGINN, B, 104, 2);            // spaeter per Rueckruf: ueber allen befuellten
  CHECK(gezeigteFreigabe(ein) == 104);
  const std::vector<FreigabeEintrag> leer;
  CHECK(ein.befuellen(&leer, true) == Befuellt::Leer && ein.eintraege().size() == 4);
  CHECK(ein.befuellen(nullptr, true) == Befuellt::NichtVerfuegbar && ein.eintraege().size() == 4);
  CHECK(ein.befuellen(nullptr, false) == Befuellt::NichtVerfuegbar && ein.eintraege().empty());   // INMEETING ohne Liste
}

void pb27_typ_nachtrag() {
  std::printf("PB27 Freigabe: Typ-Nachtrag ohne neues seq; COMPUTER_AUDIO -> audioOnly; Kennung 0 nachgezogen\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, TYP_UNBEKANNT);
  l.status(STATUS_FREMD_BEGINN, B, F2, TYP_UNBEKANNT);
  const uint64_t seqA = l.eintraege()[0].seq;
  CHECK(l.typNachtrag(A, F1, 2));
  CHECK(l.eintraege()[0].type == 2 && l.eintraege()[0].seq == seqA);
  CHECK(gezeigteFreigabe(l) == F2);
  CHECK(l.typNachtrag(B, F2, TYP_COMPUTERTON));
  CHECK(l.eintraege()[1].audioOnly && gezeigteFreigabe(l) == F1);
  CHECK(!l.typNachtrag(C, F3, 2));                     // ohne passenden Eintrag nichts
  FreigabeListe null;
  null.status(STATUS_FREMD_BEGINN, A, 0, TYP_UNBEKANNT);   // Kennung 0 (Annahme AN19)
  const uint64_t seq0 = null.eintraege()[0].seq;
  CHECK(null.typNachtrag(A, F1, 1));
  CHECK(null.eintraege()[0].share == F1 && null.eintraege()[0].type == 1 && null.eintraege()[0].seq == seq0);
  CHECK(gezeigteFreigabe(null) == F1);
}

// ── ENDE DER FALLFUNKTIONEN (neue Funktionen direkt darüber einfügen) ──
}  // namespace

int main() {
  a4_namen();
  pb1_haltezeit_genau();
  pb2_neuer_kandidat_startet_neu();
  pb3_ohne_ziel_sofort();
  pb4_eigene_und_null_nie();
  pb5_aktives_audio_liste();
  pb6_ohne_kamera();
  pb7_nur_gewaehltes_signal();
  pb8_gezeigter_geht();
  pb9_haltezeit_grenzen();
  pb26_erinnerung_belegt_vor();
  a5_namen();
  pb10_ruecksprung();
  pb11_pause();
  pb12_tonfreigabe_nie_gezeigt();
  pb13_person_geht();
  pb14_eigene_freigaben_nichts();
  pb15_befuellen();
  pb27_typ_nachtrag();
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
