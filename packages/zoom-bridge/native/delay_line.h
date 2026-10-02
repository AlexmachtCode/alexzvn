#pragma once
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <utility>
#include <vector>

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
    bool black = false;
    int w = 0;
    int h = 0;
    std::vector<uint8_t> data;   // leer bei einem Schwarzbild
    TimePoint arrival{};
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
    Frame f;
    f.w = w;
    f.h = h;
    f.arrival = arrival;
    if (!spare_.empty()) {
      f.data = std::move(spare_.back());
      spare_.pop_back();
    }
    f.data.assign(buf, buf + len);
    return push(std::move(f));
  }

  /**
   * Ein Schwarzbild laeuft durch DIESELBE Warteschlange wie echte Bilder -
   * sonst ueberholte es die noch wartenden Bilder, und die Quelle zeigte
   * Schwarz, bevor die letzten Bilder vor dem Kamera-Aus durch sind.
   */
  int pushBlack(int w, int h, TimePoint arrival) {
    Frame f;
    f.black = true;
    f.w = w;
    f.h = h;
    f.arrival = arrival;
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
    size_t faellig = 0;
    while (faellig < queue_.size() && queue_[faellig].arrival + delay <= now) ++faellig;

    Released r;
    if (faellig > kMaxBurst) {
      for (size_t i = 0; i + 1 < faellig; ++i) {
        recycle(std::move(queue_.front()));
        queue_.pop_front();
        ++r.dropped;
      }
      faellig = 1;
    }
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
