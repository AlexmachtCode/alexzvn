#pragma once
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <memory>
#include <utility>
#include <vector>

/**
 * Art eines Bildes in der Warteschlange (Spec 6.12, 6.14, PB18, #306): I420 traegt Zooms Bilddaten, die drei Ersatzbilder
 * Schwarz, Weiss und Transparent tragen keine (der Sender baut sie aus seinen Puffern je Groesse). Kachel traegt einen
 * fertigen, unveraenderlichen I420-Puffer als VERWEIS (kachel), nie als Kopie. Statt nur „Bild oder Schwarz“.
 * Einpassen (#310) traegt wie I420 Zooms Bilddaten als Kopie (das ROHBILD, ~1,4 MB bei 1080p statt ~6,2 MB fuer den
 * fertigen UYVA-Rahmen) und dazu die Rahmengroesse rahmenW x rahmenH; eingepasst wird erst beim Ausgeben (NdiSender).
 */
enum class Bildart : uint8_t { I420, Schwarz, Weiss, Transparent, Kachel, Einpassen };

/**
 * Bild-Verzoegerung einer Zoom-Quelle (Abnahmepunkt 5, Lippensynchronitaet).
 *
 * WARUM DAS BILD UND NICHT DER TON: am 18.08.2026 lief der Ton dem Bild
 * hinterher - GESCHAETZT (nach Gehoer) knapp eine halbe Sekunde, gleich-
 * bleibend. GEMESSEN ist nur unser eigener Anteil daran: rund 6 ms (README
 * Abschnitt 8). Der Rest entsteht bei Zoom - und ist
 * von innen NICHT ausrichtbar, weil YUVRawDataI420 keinen Zeitstempel traegt.
 * Was zu frueh kommt, muss warten: also das Bild.
 *
 * REINE LOGIK: kennt weder NDI noch Zoom noch eine Uhr. Jede Zeit wird
 * eingespeist, damit native/delay_line_test.cpp das Verhalten ohne Meeting
 * und in Millisekunden pruefen kann. Nicht threadsicher - NdiSender legt
 * seine eigene Sperre darum (ndi_sender.h).
 */
class DelayLine {
 public:
  using Clock = std::chrono::steady_clock;
  using TimePoint = Clock::time_point;

  /**
   * Hoechstens so viele faellige Bilder gehen in EINEM release() raus. Sind
   * mehr faellig - der Versatz wurde verkleinert, oder die Schleife stand -,
   * geht nur das juengste raus und der Rest wird verworfen. GEWAEHLT, nicht
   * gemessen: ein Schwall von 15 1080p-Bildern waere synchron gesendet ein
   * Vielfaches der Bildzeit auf Zooms Rueckruf-Thread, und der Empfaenger
   * zeigte sie ohnehin nur im Zeitraffer. 3 laesst normales Zittern der
   * Ankunft (zwei, drei Bilder kurz hintereinander) unangetastet.
   */
  static constexpr size_t kMaxBurst = 3;

  /**
   * Obergrenze der Warteschlange. 1000 ms Versatz (die Obergrenze des
   * Befehls videoDelay) bei 30 Bildern je Sekunde sind 30 Bilder - 90 laesst
   * Luft fuer eine hoehere Bildrate, begrenzt aber den Speicher, falls
   * release() laengere Zeit nicht laeuft. Verworfen wird das AELTESTE: das
   * neueste ist das, das der Empfaenger als naechstes sehen soll.
   */
  static constexpr size_t kMaxQueue = 90;

  /**
   * Hoechstens so viele Puffer bleiben im Vorrat. Im Gleichlauf nimmt jedes
   * pushFrame() genau einen und jedes release() gibt genau einen zurueck - der
   * Vorrat pendelt um 1. Alles darueber stammt aus einem Schwall (Versatz
   * verkleinert, Ausgabe stand) und wird freigegeben statt gehortet (Review
   * 30.09.2026: ohne Deckel blieb nach einem Ausflug auf 1000 ms bei 1080p
   * rund 96 MB je Quelle bis zum Abo-Ende belegt, auch bei Versatz 0).
   */
  static constexpr size_t kMaxSpare = 4;

  /**
   * Wie lange ein Bild UEBERFAELLIG sein muss, bevor der Nachlauf
   * (releaseNachlauf, aus der Hauptschleife) es ausgibt. Laenger als ein
   * Bildabstand bei 30 Bildern je Sekunde (33,3 ms), damit im Normalbetrieb
   * immer das naechste eintreffende Bild zuerst anstoesst und die Quelle
   * Zooms Takt behaelt. GEWAEHLT, nicht gemessen: 70 ms deckt auch rund 15
   * Bilder je Sekunde ab. Die Zaehler in NdiSender (vom Rueckruf / vom
   * Nachlauf) machen im Abnahmelauf sichtbar, ob das traegt.
   */
  static constexpr std::chrono::milliseconds kNachlaufKarenz{70};

  struct Frame {
    Bildart art = Bildart::I420;
    int w = 0;
    int h = 0;
    std::vector<uint8_t> data;   // leer bei Schwarz, Weiss, Transparent und Kachel
    std::shared_ptr<const std::vector<uint8_t>> kachel;   // nur bei Bildart::Kachel gesetzt
    TimePoint arrival{};
    int rahmenW = 0;   // nur bei Bildart::Einpassen: Groesse des UYVA-Rahmens, in den das Rohbild w x h kommt
    int rahmenH = 0;
  };

  struct Released {
    int sent = 0;
    int dropped = 0;
  };

  /**
   * Legt eine KOPIE des Bildes ab - Zooms Puffer gehoert nach dem Rueckruf
   * wieder Zoom. Der Speicher kommt, wo moeglich, aus dem Vorrat bereits
   * ausgegebener Bilder: je Bild neu anzufordern waere bei 1080p rund 3 MB,
   * 30-mal je Sekunde und Quelle.
   *
   * @return wie viele Bilder die Obergrenze dabei verdraengt hat (0 oder 1).
   */
  int pushFrame(const uint8_t* buf, size_t len, int w, int h, TimePoint arrival) {
    return push(kopie(buf, len, w, h, arrival));
  }

  /**
   * Ein Ersatzbild ohne Bilddaten (Schwarz, Weiss, Transparent) laeuft durch DIESELBE Warteschlange wie echte
   * Bilder - sonst ueberholte es die noch wartenden Bilder, und die Quelle zeigte Schwarz, bevor die letzten Bilder
   * vor dem Kamera-Aus durch sind. I420 traegt Bilddaten und geht nur ueber pushFrame: pushBild(Bildart::I420, ...)
   * legt nichts ab. Ebenso die Kachel (#306): sie trägt einen Puffer und geht nur über pushKachel - sonst läge ein
   * Frame ohne Verweis in der Warteschlange. Und Einpassen (#310) nur ueber pushEinpassen (Bilddaten + Rahmen).
   */
  int pushBild(Bildart art, int w, int h, TimePoint arrival) {
    if (art == Bildart::I420 || art == Bildart::Kachel || art == Bildart::Einpassen) return 0;
    Frame f;
    f.art = art;
    f.w = w;
    f.h = h;
    f.arrival = arrival;
    return push(std::move(f));
  }

  /**
   * Eine Kachel (#306) laeuft durch DIESELBE Warteschlange wie Bilder und Ersatzbilder - aus demselben Grund wie bei
   * pushBild. Der Puffer wird NICHT kopiert: die Warteschlange haelt nur den Verweis, der mit dem Frame faellt
   * (recycle legt ihn nicht in den Vorrat). Legt nichts ab (Rueckgabe 0), wenn `puffer` leer ist oder seine Groesse
   * nicht der I420-Groesse w*h + 2*(w/2)*(h/2) entspricht.
   *
   * @return wie viele Bilder die Obergrenze dabei verdraengt hat (0 oder 1).
   */
  int pushKachel(std::shared_ptr<const std::vector<uint8_t>> puffer, int w, int h, TimePoint arrival) {
    if (!puffer || w <= 0 || h <= 0) return 0;
    if (puffer->size() != i420Laenge(w, h)) return 0;
    Frame f;
    f.art = Bildart::Kachel;
    f.w = w;
    f.h = h;
    f.kachel = std::move(puffer);
    f.arrival = arrival;
    return push(std::move(f));
  }

  /**
   * Ein Rohbild „einpassen“ (#310): eine KOPIE wie pushFrame (Puffer aus dem Vorrat), dazu die Groesse des
   * UYVA-Rahmens, in den der Sender es erst beim Ausgeben einpasst. Legt nichts ab (Rueckgabe 0) ohne Puffer, bei
   * w, h, rahmenW oder rahmenH <= 0 oder wenn `len` nicht der I420-Groesse w*h + 2*(w/2)*(h/2) entspricht: die
   * Einpassung liest spaeter genau so viel - ausserhalb der Sender-Sperre.
   *
   * @return wie viele Bilder die Obergrenze dabei verdraengt hat (0 oder 1).
   */
  int pushEinpassen(const uint8_t* buf, size_t len, int w, int h, int rahmenW, int rahmenH, TimePoint arrival) {
    if (!buf || w <= 0 || h <= 0 || rahmenW <= 0 || rahmenH <= 0) return 0;
    if (len != i420Laenge(w, h)) return 0;
    Frame f = kopie(buf, len, w, h, arrival);
    f.art = Bildart::Einpassen;
    f.rahmenW = rahmenW;
    f.rahmenH = rahmenH;
    return push(std::move(f));
  }

  /**
   * Gibt jedes Bild an `sink`, das bei `delay` zum Zeitpunkt `now` faellig
   * ist (Ankunft + Versatz <= jetzt), in Ankunftsreihenfolge.
   *
   * Der Versatz wird bei JEDEM Aufruf neu angelegt und nicht beim Ablegen
   * eingebrannt: eine Aenderung wirkt damit sofort, auch auf wartende Bilder.
   */
  template <class Sink>
  Released release(TimePoint now, std::chrono::milliseconds delay, Sink&& sink) {
    Released r;
    const size_t faellig = faelligAbzaehlen(now, delay, r);
    for (size_t i = 0; i < faellig; ++i) {
      Frame f = std::move(queue_.front());
      queue_.pop_front();
      sink(static_cast<const Frame&>(f));
      ++r.sent;
      recycle(std::move(f));
    }
    return r;
  }

  /**
   * Wie release(), aber ohne Senke (#310): haengt die auszugebenden Bilder in Ankunftsreihenfolge an `aus` (erwartet
   * leer). DIESELBE Faelligkeits- und Schwallregel - ein gemeinsamer Helfer (faelligAbzaehlen), keine zweite Regel.
   * Fuer den Sender, der zwischen Entnehmen und Senden seine Sperre oeffnet (Einpassen ausserhalb der Sperre). Die
   * Puffer gehoeren danach `aus`; in den Vorrat gehen sie mit zuruecklegen(). Der Nachlauf entnimmt mit
   * `now - kNachlaufKarenz`, genau wie releaseNachlauf().
   */
  Released entnehmen(TimePoint now, std::chrono::milliseconds delay, std::vector<Frame>& aus) {
    Released r;
    const size_t faellig = faelligAbzaehlen(now, delay, r);
    // Hoechstens kMaxBurst je Aufruf: einmal angefordert, danach entnimmt jeder Aufruf ohne Speicheranforderung.
    if (aus.capacity() < kMaxBurst) aus.reserve(kMaxBurst);
    for (size_t i = 0; i < faellig; ++i) {
      aus.push_back(std::move(queue_.front()));
      queue_.pop_front();
      ++r.sent;
    }
    return r;
  }

  /**
   * Gibt die Puffer entnommener Bilder in den Vorrat zurueck (Deckel kMaxSpare, wie nach release()); `aus` ist
   * danach leer. Auch nach clear() zulaessig: dann liegen danach hoechstens kMaxSpare Puffer im Vorrat.
   */
  void zuruecklegen(std::vector<Frame>& aus) {
    for (Frame& f : aus) recycle(std::move(f));
    aus.clear();
  }

  /**
   * Der NACHLAUF: gibt nur aus, was laenger als kNachlaufKarenz ueberfaellig
   * ist - also Bilder, die das naechste eintreffende Bild offensichtlich nicht
   * mehr anstoesst (Kamera aus, Gast weg, Zoom stockt). Fuer die Hauptschleife
   * (NdiSender::pump()). "Ankunft + Versatz + Karenz <= jetzt" ist dasselbe
   * wie "Ankunft + Versatz <= jetzt - Karenz" - darum dieselbe Ausgabe mit
   * vorgezogener Uhr, keine zweite Faelligkeitsregel.
   */
  template <class Sink>
  Released releaseNachlauf(TimePoint now, std::chrono::milliseconds delay, Sink&& sink) {
    return release(now - kNachlaufKarenz, delay, std::forward<Sink>(sink));
  }

  size_t size() const { return queue_.size(); }

  /** Wie viele Bildpuffer auf Wiederverwendung warten. */
  size_t spareBuffers() const { return spare_.size(); }

  /** Verwirft alles, auch den Vorrat - der Speicher geht zurueck. */
  void clear() {
    queue_.clear();
    spare_.clear();
    spare_.shrink_to_fit();
  }

 private:
  /** I420-Groesse w x h: Y-Ebene plus zwei Viertel-Ebenen (abgerundet wie Zoom und einpass::i420Bytes). */
  static size_t i420Laenge(int w, int h) {
    return static_cast<size_t>(w) * static_cast<size_t>(h) + 2 * static_cast<size_t>(w / 2) * static_cast<size_t>(h / 2);
  }

  /** Ein Frame mit einer KOPIE von buf, der Puffer wo moeglich aus dem Vorrat (pushFrame, pushEinpassen). */
  Frame kopie(const uint8_t* buf, size_t len, int w, int h, TimePoint arrival) {
    Frame f;
    f.w = w;
    f.h = h;
    f.arrival = arrival;
    if (!spare_.empty()) {
      f.data = std::move(spare_.back());
      spare_.pop_back();
    }
    f.data.assign(buf, buf + len);
    return f;
  }

  /**
   * Die Faelligkeits- und Schwallregel fuer release() UND entnehmen(): zaehlt die vorn in der Warteschlange faelligen
   * Bilder (Ankunft + Versatz <= jetzt) und verwirft bei mehr als kMaxBurst alle bis auf das juengste (in den Vorrat,
   * gezaehlt in r.dropped). @return wie viele Bilder vorn jetzt auszugeben sind (hoechstens kMaxBurst).
   */
  size_t faelligAbzaehlen(TimePoint now, std::chrono::milliseconds delay, Released& r) {
    size_t faellig = 0;
    while (faellig < queue_.size() && queue_[faellig].arrival + delay <= now) ++faellig;
    if (faellig > kMaxBurst) {
      for (size_t i = 0; i + 1 < faellig; ++i) {
        recycle(std::move(queue_.front()));
        queue_.pop_front();
        ++r.dropped;
      }
      faellig = 1;
    }
    return faellig;
  }

  int push(Frame&& f) {
    int verdraengt = 0;
    if (queue_.size() >= kMaxQueue) {
      recycle(std::move(queue_.front()));
      queue_.pop_front();
      verdraengt = 1;
    }
    queue_.push_back(std::move(f));
    return verdraengt;
  }

  void recycle(Frame&& f) {
    // Ein Schwarzbild hat keinen Puffer - nichts zurueckzulegen. Ueber dem
    // Deckel wird der Puffer mit f freigegeben (siehe kMaxSpare).
    if (f.data.capacity() > 0 && spare_.size() < kMaxSpare) spare_.push_back(std::move(f.data));
  }

  std::deque<Frame> queue_;
  std::vector<std::vector<uint8_t>> spare_;
};
