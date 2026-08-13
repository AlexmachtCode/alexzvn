#include "video.h"
#include <atomic>
#include <map>
#include <memory>
#include <mutex>
#include "emit.h"
#include "ndi_sender.h"
#include "rawdata/zoom_rawdata_api.h"
// rawdata_renderer_interface.h (ueber video.h) FORWARD-deklariert
// YUVRawDataI420 nur ("class YUVRawDataI420;") - die vollstaendige Klasse mit
// GetBuffer()/GetStreamWidth()/GetRotation()/IsLimitedI420() steht erst hier.
// Ohne diesen Include bricht der Bau an jeder Methode auf *data mit C2027
// ("Verwendung des undefinierten Typs") ab.
#include "zoom_sdk_raw_data_def.h"
#include "session.h"

namespace {

struct Sub;
std::map<unsigned int, std::unique_ptr<Sub>> g_subs;

class Delegate : public IZoomSDKRendererDelegate {
 public:
  explicit Delegate(Sub* owner) : owner_(owner) {}
  void onRendererBeDestroyed() override {}
  void onRawDataFrameReceived(YUVRawDataI420* data) override;
  void onRawDataStatusChanged(RawDataStatus status) override;
 private:
  Sub* owner_;
};

struct Sub {
  // ATOMAR statt eines rohen unsigned int (Nachbesserung Runde 1, Befund 1):
  // videoParticipantJoined() (Aufgabe 6) aendert userId zur LAUFZEIT beim
  // Umhaengen - vorher stand es nach dem Anlegen fest. emitVideo()/
  // emitVideoMeasured() lesen s.userId dagegen ABSICHTLICH AUSSERHALB der
  // fieldMutex-Sperre (Regel: kein emit*() im Sperrblock) und werden auch vom
  // SDK-Thread aus gerufen (Delegate::onRawDataFrameReceived/
  // onRawDataStatusChanged). Ein Sperren des Schreibens allein haette den
  // Wettlauf NICHT geloest, weil die Leseseite weiterhin ungesperrt bliebe -
  // std::atomic macht BEIDE Seiten sicher, ohne emit*() in einen Sperrblock
  // zu ziehen.
  std::atomic<unsigned int> userId{0};
  std::string persistentId;
  std::string source;          // der TATSAECHLICH vergebene NDI-Name
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  IZoomSDKRenderer* renderer = nullptr;
  std::unique_ptr<Delegate> delegate;
  NdiSender sender;

  // Sperre NUR fuer die Feldbuchfuehrung unten (mismatchGemeldet bis
  // gemessen), NICHT fuer sender: der Bild-Rueckruf laeuft auf einem
  // SDK-Thread und schreibt diese Felder, waehrend die Hauptschleife
  // (Herzschlag, Aufgabe 5) gegenlaeufig liest und schreibt - ohne Sperre
  // waere das bei den beiden std::string-Feldern (state, reason) nicht
  // bloss ein logischer Fehler, sondern ein moeglicher Absturz durch
  // zerrissenen Zugriff. EIGENE Sperre JE ABO, keine globale - aus
  // demselben Grund, aus dem NdiSender seine Sperre je Sender haelt (siehe
  // ndi_sender.h): zwei Abos duerfen sich nicht gegenseitig ausbremsen.
  // Wird NIE ueber sender.sendI420() gehalten: NDIlib_send_send_video_v2
  // kann blockieren, bis der Puffer ausgelesen ist, und diese Sperre
  // ineinander mit der von NdiSender zu halten waere eine Verschraenkung,
  // die sich spaeter nur schwer wieder aufloest. Muster im Rueckruf darum
  // immer: erst Werte lokal aus dem Bild ziehen und senden, DANACH diese
  // Sperre nehmen und die Felder fortschreiben.
  std::mutex fieldMutex;
  bool mismatchGemeldet = false;
  ULONGLONG lastFrameMs = 0;     // 0 = noch nie ein Bild gesehen
  ULONGLONG lastBlackMs = 0;     // wird in Task 5 gebraucht
  int lastW = 0;
  int lastH = 0;
  std::string state = "subscribed";
  std::string reason = "command";
  unsigned int rotation = 0;
  bool limitedRange = true;
  bool gemessen = false;         // ob rotation/limitedRange je ein Bild gesehen haben
};

// Der Name steht bei subscribe FEST und folgt keiner Umbenennung: einen
// NDI-Sender umzubenennen hiesse, ihn abzubauen und neu aufzubauen - die
// Quelle waere mitten in der Sendung weg.
//
// KEIN DOPPELPUNKT nach "Zoom" - gemessen am 13.08.2026 gegen die echte
// NDI-Laufzeit: sie ersetzt ':' durch ein Leerzeichen, "Zoom:" haette also
// ein DOPPELTES Leerzeichen hinterlassen. Aus derselben Messung: NDI stellt
// jedem Namen den RECHNERNAMEN in Klammern voran - was im Switcher steht,
// ist "RECHNERNAME (JM Connect – Zoom Anna)". Wer auf den Namen prueft,
// prueft darum auf Teilzeichenketten, nie auf Gleichheit.
std::string uniqueSourceName(const std::wstring& displayName) {
  const std::string base = "JM Connect – Zoom " + toUtf8(displayName);
  std::string name = base;
  int n = 2;
  bool belegt = true;
  while (belegt) {
    belegt = false;
    for (const auto& [id, sub] : g_subs) {
      if (sub->source == name) { belegt = true; break; }
    }
    if (belegt) name = base + " (" + std::to_string(n++) + ")";
  }
  return name;
}

void emitVideo(const Sub& s, const char* state, const char* reason) {
  // .load() ausdruecklich statt der impliziten Wandlung: s.userId ist
  // std::atomic<unsigned int>, dieser Aufruf kann vom SDK-Thread kommen,
  // WAEHREND der Hauptthread es umhaengt (siehe Kommentar am Feld).
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId.load()) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") + "}");
}

// Wie emitVideo(), aber MIT den beiden gemessenen Feldern. Zwei getrennte
// Funktionen statt einer mit Schaltern: rotation und limitedRange duerfen
// erst auftauchen, wenn ein Bild sie geliefert hat (Spec Abschnitt 5). Eine
// erfundene 0 liesse sich spaeter nicht von einer gemessenen 0 unterscheiden.
void emitVideoMeasured(const Sub& s, const char* state, const char* reason,
                       unsigned int rotation, bool limitedRange) {
  // .load() aus demselben Grund wie in emitVideo() oben.
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId.load()) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") +
          ",\"rotation\":" + std::to_string(rotation) +
          ",\"limitedRange\":" + (limitedRange ? "true" : "false") + "}");
}

void emitVideoError(const char* code) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code + "\"}");
}

// Die fuenf NENNGROESSEN der Abos (siehe videoParseResolution()). Der
// Herzschlag (videoTick()) braucht sie fuer das ALLERERSTE Schwarzbild -
// vor dem ersten empfangenen Bild ist die tatsaechliche Groesse (lastW/
// lastH) noch 0/unbekannt, die Quelle soll aber von Anfang an eine GUELTIGE
// NDI-Aufloesung haben statt erst nach dem ersten Bild. Ein res-Wert
// ausserhalb dieser fuenf kann hier nicht ankommen: res wird ausschliesslich
// ueber videoParseResolution() (fieldFromJson()) oder die Vorgabe 720p
// (main.cpp) gesetzt.
int nominalWidth(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_90P:   return 160;
    case ZoomSDKResolution_180P:  return 320;
    case ZoomSDKResolution_360P:  return 640;
    case ZoomSDKResolution_720P:  return 1280;
    case ZoomSDKResolution_1080P: return 1920;
    default:                      return 1280;   // sollte nie erreicht werden, siehe oben
  }
}

int nominalHeight(ZoomSDKResolution res) {
  switch (res) {
    case ZoomSDKResolution_90P:   return 90;
    case ZoomSDKResolution_180P:  return 180;
    case ZoomSDKResolution_360P:  return 360;
    case ZoomSDKResolution_720P:  return 720;
    case ZoomSDKResolution_1080P: return 1080;
    default:                      return 720;    // sollte nie erreicht werden, siehe oben
  }
}

}  // namespace

bool videoParseResolution(const std::string& key, ZoomSDKResolution* out) {
  if (key == "90p")   { *out = ZoomSDKResolution_90P;   return true; }
  if (key == "180p")  { *out = ZoomSDKResolution_180P;  return true; }
  if (key == "360p")  { *out = ZoomSDKResolution_360P;  return true; }
  if (key == "720p")  { *out = ZoomSDKResolution_720P;  return true; }
  if (key == "1080p") { *out = ZoomSDKResolution_1080P; return true; }
  return false;
}

void videoSubscribe(unsigned int userId, ZoomSDKResolution res) {
  if (g_subs.count(userId)) { emitVideoError("videoAlreadySubscribed"); return; }
  // Die Erlaubnis ist Voraussetzung, kein Wunsch (siehe Spec Abschnitt 5).
  if (!sessionCanRecordRaw()) { emitVideoError("videoNoPrivilege"); return; }

  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) {
    emitVideoError("videoUnknownParticipant");
    return;
  }

  auto sub = std::make_unique<Sub>();
  sub->userId = userId;
  sub->persistentId = persistentId;
  sub->res = res;
  sub->source = uniqueSourceName(name);
  sub->delegate = std::make_unique<Delegate>(sub.get());

  if (!sub->sender.open(sub->source)) { emitVideoError("videoSenderFailed"); return; }

  SDKError err = createRenderer(&sub->renderer, sub->delegate.get());
  if (err != SDKERR_SUCCESS || sub->renderer == nullptr) {
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }
  sub->renderer->setRawDataResolution(res);
  err = sub->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  if (err != SDKERR_SUCCESS) {
    destroyRenderer(sub->renderer);
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }

  Sub* raw = sub.get();
  g_subs[userId] = std::move(sub);
  emitVideo(*raw, "subscribed", "command");
}

void videoUnsubscribe(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) { emitVideoError("videoNotSubscribed"); return; }
  Sub* s = it->second.get();
  emitVideo(*s, "unsubscribed", "command");
  // REIHENFOLGE IST TRAGEND: erst den Renderer abmelden und abbauen, DANN
  // den Sender schliessen. Andersherum koennte ein Bild-Rueckruf, der schon
  // unterwegs ist, auf einen bereits abgebauten Sender schreiben.
  if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
  s->sender.close();
  g_subs.erase(it);
}

void videoShutdownAll() {
  for (auto& [id, s] : g_subs) {
    if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
    s->sender.close();
  }
  g_subs.clear();
}

// LAEUFT AUF DEM HAUPTTHREAD (siehe main.cpp: direkt nach pumpOnce(), alle
// 10 ms). Der Bild-Rueckruf (Delegate::onRawDataFrameReceived) laeuft auf
// einem SDK-Thread - beide treffen sich in den Feldern von Sub, darum
// dieselbe Sperr-Disziplin wie dort (siehe Sub::fieldMutex): erst lokal aus
// den Feldern lesen und ENTSCHEIDEN, dann OHNE Sperre senden, dann unter der
// Sperre fortschreiben. Die Sperre wird NIE ueber sender.sendBlack()
// gehalten - NdiSender haelt seine EIGENE Sperre, zwei ineinander gehaltene
// Sperren waeren eine Verschraenkung.
//
// Veraendert die KARTE g_subs selbst NICHT (kein insert/erase) - das bleibt
// Aufgabe 6 vorbehalten. Iterieren ohne Kartensperre ist hier gefahrlos,
// weil der Bild-Rueckruf die Karte nachweislich nicht anfasst (siehe
// Sub::fieldMutex-Kommentar) und alle Karten-Mutationen (videoSubscribe/
// videoUnsubscribe/videoShutdownAll) ohnehin auf demselben Hauptthread
// laufen wie videoTick() selbst.
void videoTick() {
  const ULONGLONG jetzt = GetTickCount64();
  for (auto& [id, s] : g_subs) {
    ULONGLONG lastFrameMs;
    ULONGLONG lastBlackMs;
    int lastW, lastH;
    ZoomSDKResolution res;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      lastFrameMs = s->lastFrameMs;
      lastBlackMs = s->lastBlackMs;
      lastW = s->lastW;
      lastH = s->lastH;
      res = s->res;
    }

    // 200 ms Nachlauf: bei kurzen Aussetzern soll NICHT zwischen Bild und
    // Schwarz geflackert werden. Erst danach gilt der Strom als still.
    if (lastFrameMs != 0 && jetzt - lastFrameMs < 200) continue;
    // Hoechstens alle 100 ms, also 10 Bilder je Sekunde. Das haelt die
    // Quelle fuer jeden Empfaenger gueltig und kostet fast nichts.
    if (jetzt - lastBlackMs < 100) continue;

    // Vor dem ersten Bild ist die Bildgroesse unbekannt - dann die
    // NENNGROESSE des Abos nehmen, damit die Quelle von Anfang an gueltig
    // ist statt erst nach dem ersten Bild.
    const int w = lastW > 0 ? lastW : nominalWidth(res);
    const int h = lastH > 0 ? lastH : nominalHeight(res);

    // Senden OHNE Sperre - sendBlack() nimmt NdiSenders eigene Sperre.
    s->sender.sendBlack(w, h);

    // Fortschreiben NACH dem Senden, wieder unter der Sperre. lastBlackMs
    // wird UNBEDINGT gesetzt (der Herzschlag lief gerade, das bereits
    // gesendete Schwarzbild laesst sich ohnehin nicht zurueckholen). Der
    // BERICHT (state/reason/Ereignis) ist dagegen an ZWEI Bedingungen
    // gebunden - beide aus der Nachbesserung (Befund 1+2):
    //
    // (a) lastFrameMs != 0 (die Momentaufnahme aus Sperre 1, NICHT
    //     s->lastFrameMs): war lastFrameMs beim Entscheiden bereits 0, hat
    //     dieses Abo noch NIE ein Bild gesehen - "cameraOff" wuerde ein
    //     SDK-Ereignis behaupten, das nie stattfand. Der Zustand bleibt
    //     "subscribed" (Spec: "Sender steht, noch kein Bild"), das
    //     Schwarzbild wird trotzdem gesendet.
    // (b) s->lastFrameMs == lastFrameMs: sendBlack() oben kann blockieren,
    //     bis NDI den Puffer ausgelesen hat (NDIlib_send_send_video_v2) -
    //     in dieser Spanne, WAEHREND diese Sperre nicht gehalten wird, kann
    //     der Bild-Rueckruf laengst ein neues Bild verarbeitet und
    //     s->lastFrameMs veraendert haben. Weicht der aktuelle Wert von der
    //     Momentaufnahme ab, ist die Entscheidung "still" VERALTET - der
    //     Strom laeuft nachweislich schon wieder, der Uebergang nach
    //     "black" (und die Meldung) unterbleibt. Das schon gesendete
    //     Schwarzbild bleibt stehen (hinnehmbar, ein einzelnes Bild ist
    //     kein falscher BERICHT), aber es wird nichts Falsches gemeldet.
    //
    // Ein bereits schwarzes Abo bekommt ausserdem keine weitere Meldung -
    // Wiederholung ohne neue Information. Ein laufender bufferMismatch ist
    // eine ANDERE Ursache als "Kamera aus" und bleibt darum erhalten (siehe
    // Aufgabe 4, reason wird beim Uebergang nach "live" bereits korrekt auf
    // "frames" zurueckgesetzt - hier steht also nie ein veralteter Wert).
    std::string emitReason;
    bool sollEmit = false;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      s->lastBlackMs = jetzt;
      if (lastFrameMs != 0 && s->lastFrameMs == lastFrameMs && s->state != "black") {
        s->state = "black";
        if (s->reason != "bufferMismatch") s->reason = "cameraOff";
        emitReason = s->reason;
        sollEmit = true;
      }
    }
    // emitVideo() ausserhalb JEDER Sperre - dieselbe Regel wie im
    // Bild-Rueckruf: kein emit*() innerhalb eines Sperrblocks.
    if (sollEmit) emitVideo(*s, "black", emitReason.c_str());
  }
}

// LAEUFT AUF DEM HAUPTTHREAD (die Teilnehmer-Rueckrufe onUserLeft/onUserJoin
// kommen ueber die Nachrichtenpumpe, siehe callbacks.cpp und main.cpp). Fasst
// dieselben Felder an wie der Bild-Rueckruf (state, reason, lastFrameMs,
// gemessen, mismatchGemeldet) - darum dieselbe Sperr-Disziplin wie dort und
// in videoTick() (siehe Sub::fieldMutex): die Sperre schuetzt NUR den
// Feldzugriff, wird NIE ueber einen Renderer- oder NDI-Aufruf gehalten und
// kein emit*() liegt in einem Sperrblock.
void videoParticipantLeft(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) return;
  Sub* s = it->second.get();
  // Das Abo bleibt bestehen - die Quelle darf im Livebetrieb nicht
  // wegbrechen (Spec Abschnitt 3). Der Herzschlag (videoTick()) haelt sie ab
  // jetzt schwarz.
  if (s->renderer) { s->renderer->unSubscribe(); }
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    s->state = "black";
    s->reason = "participantLeft";
  }
  emitVideo(*s, "black", "participantLeft");
}

// Ebenfalls HAUPTTHREAD, siehe videoParticipantLeft() oben.
void videoParticipantJoined(unsigned int userId) {
  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) return;

  // Eine LEERE persistentId kann NIEMANDEN wiedererkennen: zwei verschiedene
  // Gaeste haetten beide "" und wuerden aufeinander umgehaengt - aus einem
  // Wiederbeitritt wuerde eine Personenverwechslung auf Sendung. Kein Abo
  // traegt darum jemals eine leere persistentId zum Vergleich heran (siehe
  // uniqueSourceName/videoSubscribe), dieser Rueckgabewert bleibt trotzdem
  // die einzige Instanz, die das PRUEFT statt es vorauszusetzen.
  if (persistentId.empty()) return;

  // ERST SUCHEN, DANN UMHAENGEN - in zwei getrennten Schritten. extract()
  // mitten in der Schleife wuerde den Laufzeiger ungueltig machen.
  unsigned int alteId = 0;
  bool gefunden = false;
  for (const auto& [id, s] : g_subs) {
    if (id != userId && s->persistentId == persistentId) { alteId = id; gefunden = true; break; }
  }
  if (!gefunden) return;

  // KEIN neues Sub bauen: der Delegate haelt einen ROHEN Zeiger auf dieses
  // Objekt (owner_ in Delegate, gesetzt in videoSubscribe()). extract() zieht
  // nur den KNOTEN samt unique_ptr aus der Map - das Sub-Objekt bleibt an
  // seiner Adresse stehen, der Delegate-Zeiger bleibt gueltig. Ein
  // erase()+neues Sub liesse den Delegate eines noch laufenden Renderers auf
  // freigegebenen Speicher zeigen.
  auto knoten = g_subs.extract(alteId);
  Sub* s = knoten.mapped().get();
  s->userId = userId;
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    // DERSELBE Sender bleibt bestehen - fuer den Switcher ist nichts
    // passiert, was er merken muesste. state UND lastFrameMs werden
    // ZUSAMMEN zurueckgesetzt: ein Abo, das noch nie ein Bild gesehen hat
    // (lastFrameMs == 0), haelt videoTick() bewusst auf "subscribed" statt
    // es als "cameraOff" zu melden (Aufgabe 5). Bliebe state hier auf einem
    // alten Wert wie "live" stehen, wuerde ein umgehaengtes Abo dauerhaft
    // einen Zustand behaupten, der nicht mehr gilt, ohne dass je ein
    // berichtigendes Ereignis kaeme.
    s->state = "subscribed";
    s->reason = "rebound";
    s->lastFrameMs = 0;
    s->gemessen = false;
    s->mismatchGemeldet = false;
  }
  if (s->renderer) {
    // ERST abmelden: das alte Abo haengt noch an der TOTEN Kennung. Ein
    // subscribe() auf einen bereits abonnierten Renderer liefert einen
    // SDK-Fehler statt umzuschalten.
    s->renderer->unSubscribe();
    s->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  }
  knoten.key() = userId;
  // Rueckgabewert PRUEFEN statt verwerfen (Nachbesserung Runde 1, Befund 2):
  // schluege insert() fehl (userId waere selbst bereits ein Schluessel in
  // g_subs), gaebe der Aufruf den Knoten unveraendert in ergebnis.node
  // zurueck. Ihn dort einfach verwerfen liesse (ergebnis.node) sofort ausser
  // Sichtweite zerstoert werden - MIT dem gerade oben umsubscribe()-ten
  // Renderer und seinem Delegate, waehrend dieser Renderer noch aktiv auf
  // "userId" haengt. Das Abo waere STILL weg, ohne jedes Ereignis, und der
  // Delegate-Zeiger eines gerade noch laufenden Renderers zeigte anschliessend
  // ins Leere - genau die Gefahr, vor der der Kommentar oben (KEIN neues Sub
  // bauen) bereits warnt, nur von der anderen Seite.
  auto ergebnis = g_subs.insert(std::move(knoten));
  if (!ergebnis.inserted) {
    // Nach heutigem Aufbau praktisch unerreichbar (eine frisch beigetretene
    // Kennung hat noch kein eigenes Abo) - trotzdem sauber abbauen, GENAU wie
    // videoUnsubscribe() es tut, statt den verwaisten Knoten kommentarlos
    // auslaufen zu lassen.
    Sub* verwaist = ergebnis.node.mapped().get();
    if (verwaist->renderer) { verwaist->renderer->unSubscribe(); destroyRenderer(verwaist->renderer); }
    verwaist->sender.close();
    // DIESELBE Ursache wie ein direktes videoSubscribe auf eine bereits
    // belegte Kennung: "userId" hat in beiden Faellen bereits ein Abo. Kein
    // neuer Katalogeintrag noetig - videoAlreadySubscribed traegt schon
    // genau diese Bedeutung.
    emitVideoError("videoAlreadySubscribed");
    return;
  }
  emitVideo(*s, "subscribed", "rebound");
}

namespace {

void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  if (!data || !owner_) return;
  const int w = static_cast<int>(data->GetStreamWidth());
  const int h = static_cast<int>(data->GetStreamHeight());
  const uint8_t* buf = reinterpret_cast<const uint8_t*>(data->GetBuffer());

  // DER PUFFER WIRD GEPRUEFT, NICHT GEGLAUBT. NDI erwartet die drei Ebenen
  // ZUSAMMENHAENGEND (Y, dann U, dann V) in EINEM Puffer - GetBuffer()
  // verspricht genau das, aber ein Zeilenabstand mit Auffuellung oder eine
  // andere Anordnung wuerde ein Bild erzeugen, das wie ein Kameradefekt
  // aussieht. Man suchte dann am falschen Ende.
  const size_t erwartet = static_cast<size_t>(w) * h * 3 / 2;
  if (!buf || w <= 0 || h <= 0 || data->GetBufferLen() != erwartet) {
    // EINMAL je Abo, nicht je Bild: 30 Meldungen je Sekunde ertraenkten
    // jede andere Ausgabe. Lesen UND Setzen von mismatchGemeldet gehoeren
    // unter DIESELBE Sperre, sonst koennten zwei Rueckrufe kurz
    // hintereinander beide "false" lesen und beide melden.
    bool sollMelden = false;
    {
      std::lock_guard<std::mutex> lock(owner_->fieldMutex);
      if (!owner_->mismatchGemeldet) {
        owner_->mismatchGemeldet = true;
        owner_->reason = "bufferMismatch";
        sollMelden = true;
      }
    }
    if (sollMelden) emitVideoError("videoBufferMismatch");
    return;   // das Abo bleibt bestehen und faellt ueber den Herzschlag auf Schwarz
  }

  // Werte JETZT aus dem Bild ziehen, dann OHNE Sperre senden - sendI420()
  // kann blockieren, bis NDI den Puffer ausgelesen hat, und die Sperre auf
  // fieldMutex darf dabei nicht gehalten werden (siehe Kommentar am Feld).
  const ULONGLONG now = GetTickCount64();
  const unsigned int rot = data->GetRotation();
  const bool limited = data->IsLimitedI420();

  owner_->sender.sendI420(buf, w, h);

  // Erst beim ERSTEN brauchbaren Bild sind rotation und limitedRange
  // gemessen - vorher waeren sie erfunden.
  bool sollEmitLive = false;
  {
    std::lock_guard<std::mutex> lock(owner_->fieldMutex);
    owner_->lastFrameMs = now;
    owner_->lastW = w;
    owner_->lastH = h;
    if (!owner_->gemessen || owner_->state != "live" || owner_->rotation != rot || owner_->limitedRange != limited) {
      owner_->gemessen = true;
      owner_->rotation = rot;
      owner_->limitedRange = limited;
      owner_->state = "live";
      // Ohne diese Zeile bliebe reason nach einem vorherigen
      // bufferMismatch/cameraOff auf dem ALTEN Wert stehen, obwohl das
      // gesendete Ereignis "frames" sagt - ein spaeterer Leser (Herzschlag,
      // Aufgabe 5) saehe dann eine Ursache, die laengst nicht mehr gilt.
      owner_->reason = "frames";
      sollEmitLive = true;
    }
  }
  if (sollEmitLive) emitVideoMeasured(*owner_, "live", "frames", rot, limited);
}

void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  if (!owner_) return;
  if (status == RawData_Off) {
    {
      std::lock_guard<std::mutex> lock(owner_->fieldMutex);
      owner_->state = "black";
      owner_->reason = "cameraOff";
    }
    emitVideo(*owner_, "black", "cameraOff");
  }
  // RawData_On erzeugt hier ABSICHTLICH kein Ereignis: dass das SDK Video
  // ankuendigt, heisst noch nicht, dass Bilder ankommen. "live" wird beim
  // ersten wirklich empfangenen Bild gemeldet - eine Ankuendigung ist keine
  // Messung.
}

}  // namespace
