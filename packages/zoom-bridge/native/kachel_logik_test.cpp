// Selbsttest fuer die Inhalte der Zoom-Kachel (kachel_logik.h, #306) - OHNE Zoom, OHNE NDI, OHNE Uhr, OHNE
// Zeichnen: Initialen, Farbe, Kuerzung, Masse, Profilbild-Pruefung und I420-Umrechnung sind reine Funktionen.
//
//   npm run logik-test -w @jm/zoom-bridge
//
// Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "kachel_logik.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <iterator>
#include <memory>
#include <string>
#include <vector>

using namespace kachel;

namespace {

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

std::vector<uint32_t> cp(const std::u16string& s) { return utf16Dekodieren(s); }
std::u16string ini(const std::u16string& s) { return utf16Kodieren(initialen(cp(s))); }
std::vector<uint8_t> einfarbig(uint32_t rgb, int w, int h) {   // BGRA, deckend, stride 4*w
  std::vector<uint8_t> b(static_cast<size_t>(w) * h * 4);
  for (size_t i = 0; i < b.size(); i += 4) {
    b[i] = static_cast<uint8_t>(rgb & 0xFF); b[i + 1] = static_cast<uint8_t>((rgb >> 8) & 0xFF);
    b[i + 2] = static_cast<uint8_t>(rgb >> 16); b[i + 3] = 255;
  }
  return b;
}

// Leuchtdichte nach WCAG 2.x (sRGB).
double leuchtdichte(uint32_t rgb) {
  double l = 0;
  const double gewicht[3] = {0.2126, 0.7152, 0.0722};
  for (int k = 0; k < 3; ++k) {
    const double c = ((rgb >> (16 - 8 * k)) & 0xFF) / 255.0;
    l += gewicht[k] * (c <= 0.03928 ? c / 12.92 : std::pow((c + 0.055) / 1.055, 2.4));
  }
  return l;
}
// kontrast(a, b) nach WCAG 2.x: (L_hell + 0.05) / (L_dunkel + 0.05).
double kontrast(uint32_t a, uint32_t b) {
  const double la = leuchtdichte(a), lb = leuchtdichte(b);
  return (std::fmax(la, lb) + 0.05) / (std::fmin(la, lb) + 0.05);
}
// abweichung(bgr, rgb): groesste Differenz eines Kanals zu rgb ueber alle Bildpunkte eines BGR-Puffers.
int abweichung(const std::vector<uint8_t>& bgr, uint32_t rgb) {
  const int soll[3] = {static_cast<int>(rgb & 0xFF), static_cast<int>((rgb >> 8) & 0xFF), static_cast<int>(rgb >> 16)};
  int m = 0;
  for (size_t i = 0; i < bgr.size(); ++i) {
    const int d = std::abs(static_cast<int>(bgr[i]) - soll[i % 3]);
    if (d > m) m = d;
  }
  return m;
}

void t_utf16() {
  CHECK(cp(u"Anna") == (std::vector<uint32_t>{'A', 'n', 'n', 'a'}));
  CHECK(cp(u"\U0001F3A4") == std::vector<uint32_t>{0x1F3A4});
  CHECK(cp(std::u16string{char16_t(0xD800), u'A'}) == (std::vector<uint32_t>{0xFFFD, 'A'}));
  CHECK(utf16Kodieren({0x1F3A4, 'A'}) == u"\U0001F3A4A");
}
void t_initialen() {
  CHECK(ini(u"Anna Müller") == u"AM");               CHECK(ini(u"anna") == u"A");
  CHECK(ini(u"  Anna   Maria   Müller  ") == u"AM"); CHECK(ini(u"ömer öztürk") == u"ÖÖ");
  CHECK(ini(u"(Gast) Ben") == u"GB");                CHECK(ini(u"\U0001F3A4 Anna") == u"A");
  CHECK(ini(u"Анна Петрова") == u"АП");              CHECK(ini(u"张伟") == u"张");
  CHECK(ini(u"jean-luc picard") == u"JP");           CHECK(ini(u"O\u0308mer") == u"O\u0308");
  CHECK(ini(u"łukasz ćwik") == u"ŁĆ");               CHECK(ini(u"ÿves") == u"\u0178");
  CHECK(ini(u"ς") == u"Σ");                          CHECK(ini(u"ά") == u"\u0386");  CHECK(ini(u"ı") == u"I");
  CHECK(ini(u"") == u"");  CHECK(ini(u" \u00A0\u3000") == u"");  CHECK(ini(u"\U0001F3A4\U0001F3AC") == u"");
}
void t_farbe() {
  CHECK(fnv1a32(cp(u"Ben")) == 4128311196u);   CHECK(fnv1a32(cp(u"")) == 2166136261u);
  CHECK(farbIndex(cp(u"Anna Müller")) == 3);   CHECK(farbIndex(cp(u"  Anna Müller ")) == 3);
  CHECK(farbIndex(cp(u"Carla")) == 0);
  for (const uint32_t f : PALETTE) CHECK(kontrast(f, 0xFFFFFF) >= 4.5 && kontrast(f, HINTERGRUND) >= 2.0);
}
void t_kuerzen() {
  const Breite b10 = [](const std::vector<uint32_t>& t) {   // 10 px je Code-Punkt, Kombinationszeichen 0 px
    int n = 0;
    for (const uint32_t c : t) n += (c >= 0x0300 && c <= 0x036F) ? 0 : 10;
    return n;
  };
  const Breite alle10 = [](const std::vector<uint32_t>& t) { return static_cast<int>(t.size()) * 10; };
  CHECK(kuerzen(cp(u"Anna"), 100, b10) == cp(u"Anna"));
  CHECK(kuerzen(cp(u"Abcdefghij"), 100, b10) == cp(u"Abcdefghij"));      // genau 100 passt
  CHECK(kuerzen(cp(u"Abcdefghijk"), 100, b10) == cp(u"Abcdefghi…"));
  CHECK(kuerzen(cp(u"Abcdefgh jk"), 100, b10) == cp(u"Abcdefgh…"));      // Leerraum vor „…“ faellt weg
  CHECK(kuerzen(cp(u"Abcdefghe\u0301zz"), 100, b10) == cp(u"Abcdefghe\u0301…"));
  CHECK(kuerzen(cp(u"Abcdefghe\u0301z"), 100, alle10) == cp(u"Abcdefgh…"));   // nie vor einem Kombinationszeichen
  CHECK(kuerzen(cp(u"Abcdefgh\U0001F469\u200D\U0001F4BB"), 100, alle10) == cp(u"Abcdefgh…"));   // ZWJ-Folge ganz
  CHECK(kuerzen(cp(u"Anna"), 5, b10) == cp(u"…"));
  CHECK(kuerzen(cp(u""), 100, b10).empty());
}
void t_masse() {
  const KachelMasse m = masse(1280, 720);
  CHECK(m.durchmesser == 288 && m.mitteX == 640 && m.mitteY == 324 && m.initialenPx == 115 && m.hinweisPx == 32);
  CHECK(m.hinweisOben == 497 && m.rand == 18 && m.namePx == 36 && m.schildHoehe == 58 && m.schildY == 644);
  CHECK(m.textAbstand == 14 && m.maxTextBreite == 1216);
  const KachelMasse g = masse(1920, 1080);
  CHECK(g.durchmesser == 432 && g.mitteY == 486 && g.initialenPx == 173 && g.hinweisOben == 745 && g.schildY == 967 && g.maxTextBreite == 1822);
  const KachelMasse k = masse(640, 360);
  CHECK(k.durchmesser == 144 && k.mitteY == 162 && k.initialenPx == 58 && k.hinweisOben == 248 && k.schildY == 322 && k.maxTextBreite == 608);
}
void t_masse_invarianten() {
  const int groessen[6][2] = {{640, 360}, {1280, 720}, {1920, 1080}, {360, 640}, {640, 480}, {320, 180}};
  for (const auto& g : groessen) {
    const KachelMasse m = masse(g[0], g[1]);
    CHECK(m.mitteX - m.durchmesser / 2 >= 0 && m.mitteX + m.durchmesser / 2 <= g[0]);
    CHECK(m.mitteY - m.durchmesser / 2 >= 0 && m.hinweisOben + m.hinweisPx * 3 / 2 <= m.schildY);
    CHECK(m.schildY >= m.rand && m.maxTextBreite > 0);
  }
}
void t_profilbild() {
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES, 100, 100) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES + 1, 100, 100) == ProfilbildFehler::ZuGross);
  CHECK(profilbildPruefen(1000, 0, 10) == ProfilbildFehler::Unlesbar);
  CHECK(profilbildPruefen(1000, 4096, 4096) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(1000, 4097, 10) == ProfilbildFehler::ZuGross);
  const Ausschnitt a = quadratAusschnitt(640, 480), b = quadratAusschnitt(300, 500), c = quadratAusschnitt(7, 4);
  CHECK(a.x == 80 && a.y == 0 && a.seite == 480);
  CHECK(b.x == 0 && b.y == 100 && b.seite == 300);
  CHECK(c.x == 1 && c.y == 0 && c.seite == 4);
}
void t_fehlername() {
  CHECK(std::string(fehlerName(ProfilbildFehler::Keiner)) == "keiner");
  CHECK(std::string(fehlerName(ProfilbildFehler::KeinPfad)) == "keinPfad");
  CHECK(std::string(fehlerName(ProfilbildFehler::Fehlt)) == "fehlt");
  CHECK(std::string(fehlerName(ProfilbildFehler::ZuGross)) == "zuGross");
  CHECK(std::string(fehlerName(ProfilbildFehler::Unlesbar)) == "unlesbar");
  CHECK(std::string(fehlerName(ProfilbildFehler::Frist)) == "frist");
}
void t_i420() {
  CHECK(i420Bytes(1280, 720) == 1382400u && i420Bytes(4, 2) == 12u);
  const auto yuv = [](uint32_t rgb) { const auto b = einfarbig(rgb, 4, 2); return bgraZuI420(b.data(), 4, 2, 16); };
  CHECK(yuv(0x232323) == (std::vector<uint8_t>{46, 46, 46, 46, 46, 46, 46, 46, 128, 128, 128, 128}));
  CHECK(yuv(0xFF0000)[0] == 82 && yuv(0xFF0000)[8] == 90 && yuv(0xFF0000)[10] == 240);
  CHECK(yuv(0xFFFFFF)[0] == 235 && yuv(0x000000)[0] == 16 && yuv(0x000000)[8] == 128);
  const uint8_t misch[16] = {0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255};   // BGRA: Rot, Blau / Blau, Rot
  const auto m = bgraZuI420(misch, 2, 2, 8);
  CHECK(m.size() == 6 && m[4] == 165 && m[5] == 175);     // U/V aus dem gerundeten Mittel (R 128, G 0, B 128)
  CHECK(grundkachelI420(4, 2) == yuv(HINTERGRUND));
  std::vector<uint32_t> farben(std::begin(PALETTE), std::end(PALETTE));
  farben.push_back(HINTERGRUND);
  farben.push_back(0xFFFFFF);
  for (const uint32_t f : farben) {                         // Rundreise, gemessen: höchstens 2 je Kanal
    std::vector<uint8_t> bgr;
    const auto y = yuv(f);
    i420ZuBgr(y.data(), 4, 2, &bgr);
    CHECK(bgr.size() == 24 && abweichung(bgr, f) <= 2);   // abweichung: groesste Kanaldifferenz ueber alle Bildpunkte
  }
}

constexpr unsigned A = 16778240, B = 16778241;
const Profil MIT{u"Anna Müller", u"C:\\p.png"};
int64_t at(int ms) { return static_cast<int64_t>(ms); }

void t_stand_profil() {
  KachelStand s;
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  CHECK(!s.profilLesenNoetig(A) && s.profilLesenNoetig(B));
  s.profilVeraltet(B);
  CHECK(!s.profilLesenNoetig(A));
  s.profilVeraltet(A);
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  s.profilVeraltet(0);
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  const KachelSchluessel k = s.soll(A, false, 1280, 720);
  CHECK(k.mitProfilbild && !(k == s.soll(A, true, 1280, 720)) && !(k == s.soll(A, false, 640, 360)) && !(k == s.soll(B, false, 1280, 720)));
  s.profilGelesen(A, MIT);
  CHECK(!(k == s.soll(A, false, 1280, 720)));                    // neuer Profilstand zeichnet neu
  s.profilGelesen(A, {u"Anna", u""});
  CHECK(!s.soll(A, false, 1280, 720).mitProfilbild);
}
void t_stand_ablauf() {
  KachelStand t;
  t.profilGelesen(A, MIT);
  const KachelSchluessel k = t.soll(A, false, 4, 2);
  CHECK(!t.hat(k) && !t.laeuft(k));
  t.gestartet(k, at(1000));
  CHECK(t.laeuft(k) && !t.hat(k) && !t.fristAbgelaufen(at(2999)) && t.fristAbgelaufen(at(3000)));
  const auto p = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{1});
  t.fertig(k, p);
  CHECK(t.hat(k) && !t.laeuft(k) && t.puffer() == p && !t.fristAbgelaufen(at(9000)));
  CHECK(t.ueberbrueckung(A, 4, 2) == p && t.ueberbrueckung(B, 4, 2) == nullptr && t.ueberbrueckung(A, 8, 2) == nullptr);
  const KachelSchluessel kh = t.soll(A, true, 4, 2);
  t.gestartet(kh, at(4000));
  const auto q = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{2});
  t.fertig(k, q);                                                // spaetes Ergebnis eines alten Auftrags
  CHECK(t.laeuft(kh) && !t.hat(kh) && t.hat(k) && t.puffer() == q);   // "fertig speichert immer": q ueberschreibt p
}
void t_stand_leeren_monoton() {
  KachelStand s;
  s.profilGelesen(A, MIT);
  const KachelSchluessel k = s.soll(A, false, 4, 2);
  s.gestartet(k, at(0));
  s.leeren();
  CHECK(s.profilLesenNoetig(A) && s.profilLesenNoetig(B) && !s.fehlerMelden());
  s.profilGelesen(A, MIT);
  const KachelSchluessel k2 = s.soll(A, false, 4, 2);
  CHECK(!(k2 == k) && k2.mitProfilbild);
  s.gestartet(k2, at(10));
  const auto q = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{3});
  s.fertig(k, q);                                                // spaetes Ergebnis aus der Zeit vor leeren()
  CHECK(!s.hat(k2) && s.laeuft(k2));
}
void t_stand_frist_neuer_stand() {
  KachelStand s;
  s.profilGelesen(A, MIT);
  const KachelSchluessel k = s.soll(A, false, 4, 2);
  s.gestartet(k, at(0));
  s.profilGelesen(A, MIT);                                       // neuer Stand, noch kein Auftrag dafuer
  s.fristAblauf();
  CHECK(!s.laeuft(k) && s.soll(A, false, 4, 2).mitProfilbild);   // aufgegeben wurde der versuchte Stand, nicht der neue
}
void t_stand_frist() {
  KachelStand f;
  f.profilGelesen(A, MIT);
  const KachelSchluessel kf = f.soll(A, false, 4, 2);
  f.gestartet(kf, at(0));
  f.fristAblauf();
  const KachelSchluessel ko = f.soll(A, false, 4, 2);
  CHECK(!ko.mitProfilbild && !f.laeuft(kf) && !f.hat(ko));      // neuer Auftrag ohne Profilbild
  f.gestartet(ko, at(2000));
  CHECK(!f.fristAbgelaufen(at(3999)) && f.fristAbgelaufen(at(4000)));
  f.fristAblauf();
  // Abschlussprüfung M2: ohne Profilbild bleibt der Auftrag stehen (er hängt an keiner Datei); nur das Warten auf ihn
  // ist vorbei - die Frist meldet sich nicht noch einmal, ein zweiter Auftrag für denselben Schlüssel kommt nicht
  // (laeuft), und bis zum Ergebnis zeigt der Slot die dunkle Fläche bzw. die Überbrückung.
  CHECK(f.laeuft(ko) && !f.hat(ko) && !f.fristAbgelaufen(at(4000)) && !f.fristAbgelaufen(at(60000)));
  CHECK(*f.grundflaeche(4, 2) == grundkachelI420(4, 2) && f.grundflaeche(4, 2) == f.grundflaeche(4, 2));
  f.profilGelesen(A, MIT);
  CHECK(f.soll(A, false, 4, 2).mitProfilbild);                   // neuer Profilstand versucht das Bild wieder
}
void t_stand_spaetes_ergebnis_ohne_profilbild() {
  // Abschlussprüfung M2: spätes Ergebnis ohne Profilbild wird übernommen. Vorher legte die Frist die dunkle Fläche
  // als Ergebnis ab, hat(k) blieb wahr, und die echte Kachel kam nie mehr an, bis sich der Schlüssel änderte.
  KachelStand s;
  s.profilGelesen(A, {u"Anna", u""});
  const KachelSchluessel k = s.soll(A, false, 4, 2);
  CHECK(!k.mitProfilbild);
  s.gestartet(k, at(0));
  CHECK(s.fristAbgelaufen(at(2000)));
  s.fristAblauf();
  CHECK(s.laeuft(k) && !s.hat(k) && !s.fristAbgelaufen(at(2001)));   // einmal gemeldet, Auftrag läuft weiter
  CHECK(!s.bildAuftragOffen(k) && s.ueberbrueckung(A, 4, 2) == nullptr);
  const auto p = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{9});
  s.fertig(k, p);                                                // das späte Ergebnis
  CHECK(s.hat(k) && s.puffer() == p && !s.laeuft(k));
  const KachelSchluessel kh = s.soll(A, true, 4, 2);             // ein neuer Auftrag setzt die Frist wieder scharf
  s.gestartet(kh, at(70000));
  CHECK(!s.fristAbgelaufen(at(71999)) && s.fristAbgelaufen(at(72000)));
}
void t_stand_fehler_einmal() {
  KachelStand f;
  f.profilGelesen(A, MIT);
  CHECK(f.fehlerMelden() && !f.fehlerMelden());
  f.profilGelesen(A, MIT);
  CHECK(f.fehlerMelden());
  f.fertig(f.soll(A, false, 4, 2), f.grundflaeche(4, 2));
  CHECK(f.speicherBytes() == i420Bytes(4, 2));                   // Puffer und Grundflaeche sind hier derselbe
  f.leeren();
  CHECK(f.puffer() == nullptr && f.speicherBytes() == 0 && f.profilLesenNoetig(A));
}
void t_stand_bildauftrag_offen() {
  // Task 7 (Review Task 6, Hinweis 1): solange ein Auftrag MIT Profilbild für dieses Ziel und diesen Profilstand
  // läuft oder hängt, kommt kein zweiter mit Profilbild – sonst hinge je Schlüsselwechsel ein Thread mehr an der Datei.
  KachelStand s;
  s.profilGelesen(A, MIT);
  const KachelSchluessel k = s.soll(A, false, 4, 2);
  CHECK(!s.bildAuftragOffen(k));                                 // kein Auftrag
  s.gestartet(k, at(0));
  const KachelSchluessel kh = s.soll(A, true, 4, 2);             // der Hinweis wechselt, der Auftrag hängt
  CHECK(s.bildAuftragOffen(kh) && s.bildAuftragOffen(s.soll(A, false, 8, 2)));
  CHECK(!s.bildAuftragOffen(s.soll(B, false, 4, 2)));            // anderes Ziel, anderes Bild
  s.fristAblauf();                                           // Frist um: das Profilbild dieses Stands ist aufgegeben
  const KachelSchluessel ohne = s.soll(A, true, 4, 2);
  CHECK(!ohne.mitProfilbild && !s.bildAuftragOffen(ohne));
  s.gestartet(ohne, at(2000));                                   // ein Auftrag ohne Profilbild sperrt nichts
  CHECK(!s.bildAuftragOffen(s.soll(A, false, 4, 2)));
  s.profilGelesen(A, MIT);                                       // neuer Profilstand: das Bild darf neu versucht werden
  const KachelSchluessel neu = s.soll(A, false, 4, 2);
  CHECK(neu.mitProfilbild && !s.bildAuftragOffen(neu));
  s.gestartet(neu, at(3000));
  s.fertig(neu, s.grundflaeche(4, 2));                           // fertig: nichts läuft mehr
  CHECK(!s.bildAuftragOffen(s.soll(A, true, 4, 2)));
}
void t_stand_nie_fremdes_profil() {
  // Task 7, Review IMPORTANT 1: das gelesene Profil gilt nur für sein Ziel. Ist für ziel noch keins gelesen (etwa
  // während der Renderer-Sperre nach einem Umhängen), gibt es keins – nie Name oder Bild eines anderen.
  KachelStand s;
  CHECK(s.profilFuer(A) == nullptr && !s.soll(A, false, 4, 2).mitProfilbild);   // noch nichts gelesen
  s.profilGelesen(A, MIT);
  CHECK(s.profilFuer(A) != nullptr && s.profilFuer(A)->name == MIT.name && s.profilFuer(A)->profilbild == MIT.profilbild);
  CHECK(s.profilFuer(B) == nullptr);                             // A gehört nicht zu B
  CHECK(!s.soll(B, false, 4, 2).mitProfilbild);                  // Bs Schlüssel trägt As Profilbild nicht
  CHECK(s.soll(A, false, 4, 2).mitProfilbild);
  s.profilVeraltet(A);                                           // veraltet, aber dieselbe Person: bleibt brauchbar
  CHECK(s.profilFuer(A) != nullptr);
  s.leeren();
  CHECK(s.profilFuer(A) == nullptr);
}
void t_stand_nicht_gefunden_wiederholt() {
  // Task 7, Review MINOR 5: kennt Zoom das Ziel gerade nicht (GetUserByUserID leer), zählt das nicht als gelesen;
  // gefragt wird wieder nach PROFIL_WIEDERHOLEN_MS (kein SDK-Aufruf je Herzschlag), ein anderes Ziel sofort.
  KachelStand s;
  CHECK(s.profilJetztLesen(A, at(1000)));
  s.profilNichtGefunden(A, at(1000));
  CHECK(s.profilFuer(A) == nullptr && s.profilLesenNoetig(A));
  CHECK(!s.profilJetztLesen(A, at(1000 + PROFIL_WIEDERHOLEN_MS - 1)) && s.profilJetztLesen(A, at(1000 + PROFIL_WIEDERHOLEN_MS)));
  CHECK(s.profilJetztLesen(B, at(1001)));                        // anderes Ziel: sofort
  CHECK(PROFIL_WIEDERHOLEN_MS >= 500);                           // höchstens zweimal je Sekunde und Slot
  s.profilGelesen(A, MIT);
  CHECK(!s.profilJetztLesen(A, at(1001)));                       // gelesen: nichts mehr zu tun
  s.profilVeraltet(A);
  CHECK(s.profilJetztLesen(A, at(1002)));                        // ein Merker nach dem Lesen fragt sofort
}
void t_stand_verwerfen_ohne_speichern() {
  // Task 7, Review MINOR 3: steht die gewünschte Kachel schon im Puffer, beendet das späte Ergebnis eines Auftrags
  // für eine andere Kachel nur den Auftrag – es ersetzt die richtige Kachel nicht.
  KachelStand s;
  s.profilGelesen(A, MIT);
  const KachelSchluessel k0 = s.soll(A, false, 4, 2);
  const auto p = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{1});
  s.gestartet(k0, at(0));
  s.fertig(k0, p);
  const KachelSchluessel k1 = s.soll(A, true, 4, 2);
  s.gestartet(k1, at(100));
  s.verwerfen(k0);                                               // ein anderer Schlüssel beendet den Auftrag nicht
  CHECK(s.laeuft(k1));
  s.verwerfen(k1);
  CHECK(!s.laeuft(k1) && s.hat(k0) && s.puffer() == p && !s.fristAbgelaufen(at(99999)) && !s.hat(k1));
}
void t_grundflaeche_auch_ausserhalb_des_zeichners() {
  // Task 7 (Review Task 6, Hinweis 3): unter 16 und über 4096 Bildpunkten zeichnet kachelZeichnen nichts; der Slot
  // sendet dann die dunkle Fläche in genau dieser (geraden) Größe – sie passt zur I420-Prüfung von sendKachel.
  const int groessen[4][2] = {{2, 2}, {8, 8}, {14, 16}, {4098, 2}};
  for (const auto& g : groessen) {
    KachelStand s;
    const Puffer p = s.grundflaeche(g[0], g[1]);
    const size_t y = static_cast<size_t>(g[0]) * static_cast<size_t>(g[1]);
    CHECK(p != nullptr && p->size() == y + 2 * static_cast<size_t>(g[0] / 2) * static_cast<size_t>(g[1] / 2) &&
          (*p)[0] == 46 && (*p)[y - 1] == 46 && (*p)[y] == 128 && p->back() == 128);
  }
}

}  // namespace

int main() {
  t_utf16();
  t_initialen();
  t_farbe();
  t_kuerzen();
  t_masse();
  t_masse_invarianten();
  t_profilbild();
  t_fehlername();
  t_i420();
  t_stand_profil();
  t_stand_ablauf();
  t_stand_leeren_monoton();
  t_stand_frist_neuer_stand();
  t_stand_frist();
  t_stand_spaetes_ergebnis_ohne_profilbild();
  t_stand_fehler_einmal();
  t_stand_bildauftrag_offen();
  t_stand_nie_fremdes_profil();
  t_stand_nicht_gefunden_wiederholt();
  t_stand_verwerfen_ohne_speichern();
  t_grundflaeche_auch_ausserhalb_des_zeichners();
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}
