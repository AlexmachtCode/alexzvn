// zoom-bridge.exe - Stage 1+2.
//
// Stage 1: Anmeldung, Meeting-Beitritt, Teilnehmerliste, Rohdaten-Aufnahme-
// Erlaubnis. Stage 2 (diese Runde): Video-Abos je Teilnehmer, je Abo ein
// eigener NDI-Sender (siehe video.cpp/ndi_sender.cpp) - "Kein NDI" gilt seit
// dieser Runde NICHT mehr, README.md Abschnitt 8 war darin veraltet.
//
// EIN Thread pumpt die Win32-Nachrichten (ohne sie kommt kein SDK-Rueckruf an),
// EIN Thread liest stdin. Der Leser legt fertige Zeilen in eine Warteschlange,
// der Hauptthread arbeitet sie zwischen zwei Pumprunden ab. Alle SDK-Aufrufe
// passieren damit auf demselben Thread, der auch pumpt.
#include <atomic>
#include <climits>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <cstdio>
#include <windows.h>
#include "emit.h"
#include "session.h"
#include "ndi_sender.h"
#include "video.h"
#include "audio.h"

namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
// atomic statt volatile: volatile garantiert KEINE Sichtbarkeit ueber
// Threadgrenzen, es haelt hier nur durch MSVC-x86-Praxis. atomic<bool> kostet
// nichts und ist tatsaechlich das, was zwischen Leser- und Hauptthread gilt.
std::atomic<bool> g_stdinClosed{false};
// Zeitpunkt (GetTickCount64) von g_stdinClosed=true. Gebraucht, um eine noch
// offene Anmeldung nach EOF nicht ewig abzuwarten - siehe die Pruefung in
// main() weiter unten.
std::atomic<ULONGLONG> g_stdinClosedAtMs{0};
std::atomic<bool> g_quit{false};
// Wird erst wahr, wenn InitSDK tatsaechlich geglueckt ist (sessionInit()
// liefert true). Steuert am Ende von main() den Ausstiegsweg - siehe dort.
std::atomic<bool> g_sdkInitialized{false};

// Owner-Entscheidung, Abschluss-Sichtung Punkt A: EIGENER, von 0 UND von
// 0xC0000005/0xC0000409 UNTERSCHIEDLICHER Rueckgabewert fuer den Fall, dass
// sessionShutdown() false liefert (die 5-s-Leave-Pumpobergrenze lief ab,
// waehrend der SDK-Thread nachweislich noch arbeitete - session.cpp). In
// GENAU diesem Zustand endete der Prozess in Aufgabe 7 GEMESSEN 5/5 mit
// 0xC0000005 - NACHGERECHNET (Schluss-Pruefung dieser Runde): das damalige
// Protokoll enthielt ein "bye" NACH der leaveTimeout-Zeile, der Abbau war
// beim Absturz also bereits zurueckgekehrt. Der Absturz kam auf dem
// REGULAEREN Ausstiegsweg (return 0 -> ExitProcess -> DLL_PROCESS_DETACH),
// NICHT nachweislich in DestroyMeetingService selbst. Darum zwei getrennte
// Dinge: den Abbau hier zu ueberspringen ist eine begruendete
// VORSICHTSMASSNAHME (fuer sich nicht gemessen), TerminateProcess() unten
// ist der GEMESSENE Teil (10/10 sauber, kein Absturz). Dokumentiert in
// README.md, Abschnitt 6 - halte den Wert dort synchron, aendert er sich
// hier.
constexpr UINT kLeaveNotSettledExitCode = 2;

void readStdin() {
  std::string line;
  int c;
  while ((c = std::fgetc(stdin)) != EOF) {
    if (c == '\n') {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      if (!line.empty()) {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_lines.push_back(line);
      }
      line.clear();
      continue;
    }
    line += static_cast<char>(c);
  }
  // Ein Aufrufer ist nicht verpflichtet, mit einem Zeilenende abzuschliessen -
  // node's child_process.spawn() haengt keins an (anders als PowerShells `|`,
  // das eins stillschweigend ergaenzt). Ohne diese Behandlung ginge der
  // letzte Befehl bei EOF spurlos verloren: kein Fehler, keine Meldung, der
  // Befehl war einfach nie da. Ein verschluckter Befehl ist schlimmer als ein
  // abgewiesener - darum dieselbe Behandlung wie bei '\n', nur am Prozessende
  // statt am Zeilenende.
  if (!line.empty() && line.back() == '\r') line.pop_back();
  if (!line.empty()) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_lines.push_back(line);
  }
  // EOF heisst quit. Stirbt die aufrufende Seite, darf keine verwaiste Bridge
  // in einem fremden Meeting sitzen bleiben. ABER: eine noch offene Anmeldung
  // (sessionAuthPending()) bekommt in main() trotzdem eine kurze Frist - siehe
  // dort. Erst den Zeitstempel setzen, dann das Flag, damit ein Leser von
  // g_stdinClosed==true den Zeitstempel bereits gueltig sieht.
  g_stdinClosedAtMs = GetTickCount64();
  g_stdinClosed = true;
}

bool nextLine(std::string& out) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_lines.empty()) return false;
  out = g_lines.front();
  g_lines.pop_front();
  return true;
}

// BERICHTIGT (Nachbesserungsrunde 1, Critical): "id" ist laut Protokoll
// (Aufgabe 2) eine ZAHL, keine Zeichenkette - fieldFromJson() liest
// AUSDRUECKLICH nur Zeichenketten (siehe session.h/session.cpp) und liefert
// fuer ein Zahlenfeld darum IMMER "". Der vorherige Stand hier
// (fieldFromJson() + std::stoul()) las "id" darum bei JEDER echten
// videoSubscribe/videoUnsubscribe-Zeile als leer und meldete deterministisch
// videoUnknownParticipant, unabhaengig davon, ob der Teilnehmer existierte -
// das Merkmal war gegen den echten Prozess unbenutzbar. numberFromJson()
// (session.h/session.cpp) liest die Ziffernfolge direkt, ohne den Umweg
// ueber eine Zeichenkette, und faengt einen Ueberlauf selbst ab (kein
// std::stoul mehr noetig, also auch keine Ausnahme, die den Prozess
// beenden koennte).
//
// ZUSAETZLICHE PRUEFUNG hier: numberFromJson() liefert unsigned long long
// (64 Bit) - absichtlich breiter als der userId-Zieltyp (unsigned int,
// 32 Bit, wie Zooms eigenes GetUserID()). Eine Zahl, die zwar innerhalb von
// unsigned long long passt, aber unsigned int sprengt, wuerde beim
// Schmalcast sonst STILL umlaufen (modulo 2^32) und koennte zufaellig auf
// eine FALSCHE, aber existierende Kennung zeigen - derselbe Grundsatz wie
// beim Ueberlauf-Fang in numberFromJson() selbst: nicht verstuemmeln, klar
// als "nicht auswertbar" melden. UINT_MAX statt std::numeric_limits<...>::max():
// windows.h definiert ohne NOMINMAX ein Makro `max`, das den STL-Aufruf
// verstuemmeln wuerde (siehe derselbe, GEMESSENE Fund in session.cpp).
bool parseParticipantId(const std::string& line, unsigned int* out) {
  unsigned long long value = 0;
  if (!numberFromJson(line, "id", &value)) return false;
  if (value > static_cast<unsigned long long>(UINT_MAX)) return false;
  *out = static_cast<unsigned int>(value);
  return true;
}

void handle(const std::string& line) {
  const std::string cmd = cmdOf(line);
  if (cmd.empty()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"parse\",\"code\":\"badJson\"}");
    return;
  }
  if (cmd == "init") {
    if (sessionInit()) g_sdkInitialized = true;
    // NDI erst nach geglueckter SDK-Initialisierung: schlaegt schon Zoom
    // fehl, ist eine NDI-Meldung nur Rauschen ueber dem eigentlichen Fehler.
    //
    // DER FEHLSCHLAG WIRD GEMERKT (Abschluss-Sichtung, M3), und zwar in
    // ndi_sender.cpp selbst (ndiIsUp()) statt in einem zweiten Merkzeichen
    // hier: videoSubscribe() fragt ihn ab und meldet dann ndiInitFailed
    // statt videoSenderFailed. Vorher blieb es bei DIESER einen Zeile - der
    // naechste Abo-Versuch schickte die Suche danach zu einem einzelnen
    // Sender statt zur fehlenden NDI-Laufzeit.
    if (g_sdkInitialized && !ndiInitialize()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
      emitLog(L"NDIlib_initialize() fehlgeschlagen - laeuft die NDI-Laufzeit auf diesem Rechner?");
    }
    return;
  }
  if (cmd == "quit") {
    g_quit = true;
    return;
  }
  if (cmd == "auth") {
    const std::string jwt = fieldFromJson(line, "jwt");
    if (jwt.empty()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
      return;
    }
    sessionAuth(jwt);
    return;
  }
  if (cmd == "join") {
    sessionJoin(fieldFromJson(line, "meetingId"), fieldFromJson(line, "passcode"), fieldFromJson(line, "displayName"));
    return;
  }
  if (cmd == "leave") {
    // TRAGENDE REIHENFOLGE, dieselbe wie unten beim Prozessende: erst alle
    // Abos, DANN das Meeting verlassen. Ein laufender Renderer haelt eine
    // Referenz auf den Meeting-Dienst - ihn nach sessionLeave() abzubauen
    // hiesse, auf abgeraeumten Zustand zuzugreifen. Ohne diese Zeile deckte
    // nur der Prozessende-Weg unten (quit/EOF) die Reihenfolge ab, der
    // "leave"-Befehl selbst nicht - GEMELDET beim Umsetzen von Aufgabe 3,
    // siehe video.h.
    videoShutdownAll();
    sessionLeave();
    return;
  }
  if (cmd == "videoSubscribe") {
    unsigned int userId = 0;
    if (!parseParticipantId(line, &userId)) {
      emitRaw("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"videoUnknownParticipant\"}");
      return;
    }
    const std::string resKey = fieldFromJson(line, "resolution");
    ZoomSDKResolution res = ZoomSDKResolution_720P;   // Vorgabe laut Spec
    if (!resKey.empty() && !videoParseResolution(resKey, &res)) {
      emitRaw("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"videoBadResolution\"}");
      return;
    }
    bool audioOn = true;   // Vorgabe laut Spec Abschnitt 7
    boolFromJson(line, "audio", &audioOn);
    // Fuer den Menschen, der die Rohausgabe mitliest - und der Beleg, den
    // test/bool-probe.mjs auswertet: ohne diese Zeile saehe ein ignorierter
    // Schalter genauso aus wie ein befolgter.
    emitLog(std::wstring(L"Ton-Schalter fuer ") + std::to_wstring(userId) +
            L": " + (audioOn ? L"an" : L"aus"));
    videoSubscribe(userId, res, audioOn);
    return;
  }
  if (cmd == "videoUnsubscribe") {
    unsigned int userId = 0;
    if (!parseParticipantId(line, &userId)) {
      emitRaw("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"videoUnknownParticipant\"}");
      return;
    }
    videoUnsubscribe(userId);
    return;
  }
  // ACHTUNG (Abschluss-Sichtung Punkt F): `cmd` kommt von AUSSEN (stdin) und
  // wird NICHT maskiert - die einzige Stelle im nativen Teil, an der ein roher
  // Aussenwert direkt in eine JSON-Zeile gespleisst wuerde. GEMESSEN, zwei
  // Folgen, wenn man das taete: ein Anfuehrungszeichen im Befehlsnamen
  // erzeugt UNGUELTIGES JSON (die Abweisung des Befehls verschluckt sich
  // selbst - genau gegen die Rangordnung, die readStdin() aufstellt: ein
  // verschluckter Befehl ist schlimmer als ein abgewiesener), und ein
  // sorgfaeltig gebauter Name kann ein FREMDES Ereignis faelschen (z. B.
  // `{"ev":"ready"}`). Der einfachere Weg ist der bessere: ein FESTES
  // "where":"cmd" auf die Rohrleitung, der Rohname ausschliesslich per
  // emitLog() auf stderr - dort kann eine unmaskierte Zeichenkette nichts
  // kaputt machen, es ist Klartext fuer Menschen, kein Maschinenkanal.
  emitRaw("{\"ev\":\"error\",\"where\":\"cmd\",\"code\":1}");  // SDKERR_NO_IMPL
  emitLog(std::wstring(L"Unbekannter Befehl abgewiesen (Name nicht in JSON gespleisst, siehe Kommentar): ") +
          toWide(cmd));
}

}  // namespace

int main(int argc, char** argv) {
  // Diagnose-Sonderweg: baut NUR einen NDI-Sender auf, schickt zwei Sekunden
  // Schwarz und geht. RUFT keine Zoom-Funktion auf - kein InitSDK, keine
  // Anmeldung, kein Beitritt. Beantwortet die Frage "traegt NDI auf diesem
  // Rechner ueberhaupt?" getrennt von der Frage "funktioniert Zoom?".
  //
  // BERICHTIGT (Nachbesserung Runde 1, Befund 2): "ruft keine Zoom-Funktion
  // auf" ist NICHT dasselbe wie "braucht Zoom nicht". zoom-bridge.exe ist
  // weiterhin gegen sdk.lib (Zoom-SDK-Importbibliothek) gebunden - der
  // Windows-Lader loest diese Bindung beim PROZESSSTART auf, VOR main(),
  // unabhaengig davon, ob dieser Zweig je eine Zoom-Funktion ruft. GEMESSEN:
  // fehlt %ZOOM_SDK_DIR%\x64\bin auf PATH, startet der Prozess ueberhaupt
  // nicht (STATUS_DLL_NOT_FOUND, 0xC0000135) - ein Zoom-EINRICHTUNGSFEHLER
  // wuerde sich dann als "NDI-Problem" tarnen, genau das Gegenteil dessen,
  // was dieser Sonderweg leisten soll. test/ndi-probe.mjs unterscheidet
  // diesen Fall inzwischen von einem echten ndiInitFailed (siehe dort, PATH-
  // Kommentar und Ursachen-Auswertung).
  if (argc > 1 && std::string(argv[1]) == "--ndi-selftest") {
    // ABWEICHUNG VOM BRIEF, GEMESSEN: alle drei Ausstiege dieses Zweigs
    // gehen ueber TerminateProcess() statt ueber ein einfaches `return`, mit
    // demselben Riegel-Muster (fflush + eigener Exitcode + return danach),
    // das weiter unten in main() fuer "InitSDK nie geglueckt" bereits steht
    // und dort ausfuehrlich begruendet ist. Grund: dieser Zweig ruft
    // absichtlich NIE Zooms InitSDK (das ist der ganze Witz des
    // Sonderwegs - "ohne Zoom"), ein regulaeres `return` haette hier also
    // GENAU die dort dokumentierte Lage hergestellt. GEMESSEN 3/3 mit
    // Exitcode -1073740791 (0xC0000409) bei allen drei `return`-Stellen des
    // Brief-Wortlauts, deterministisch reproduziert vor dieser Aenderung -
    // derselbe Absturz, derselbe Grund, den der Kommentar bei
    // g_sdkInitialized weiter unten beschreibt. Die JSON-Zeilen VOR dem
    // Absturz standen jedes Mal vollstaendig auf stdout (emitRaw() spuelt
    // selbst) - fuer test/ndi-probe.mjs, das nur die NDI-Werbung im Netz
    // prueft und den Exitcode der Bridge nicht auswertet, waere der Absturz
    // unsichtbar geblieben. Trotzdem: ein Diagnose-Sonderweg, der bei JEDEM
    // Lauf abstuerzt, ist selbst ein stiller Fehler (Kernregel "nichts
    // verschwindet still") - darum hier behoben, nicht nur vermerkt.
    if (!ndiInitialize()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
      std::fflush(stdout);
      TerminateProcess(GetCurrentProcess(), 1);
      return 1;
    }
    NdiSender s;
    // ABWEICHUNG VOM BRIEF, GEMESSEN: Name OHNE Doppelpunkt. Der urspruengliche
    // Brief-Wortlaut "JM Connect – Zoom: Selbsttest" (mit Doppelpunkt) kommt bei
    // der NDI-Quellensuche als "... Zoom  Selbsttest" an - der Doppelpunkt wird
    // durch ein Leerzeichen ersetzt, REPRODUZIERT auch mit dem laengst
    // bestehenden @jm/ndi-Addon (ndi.createSender() mit demselben Zeichen zeigt
    // dieselbe Ersetzung) - keine Eigenheit dieses neuen Codes, sondern
    // Verhalten der NDI-SDK/-Laufzeit selbst (Quellname dient zugleich als
    // mDNS/Bonjour-Dienstname, dort ist ':' reserviert). test/ndi-probe.mjs
    // prueft auf GENAUE Teilzeichenkette - mit Doppelpunkt waere Schritt 6 auf
    // JEDEM Rechner deterministisch gescheitert, nicht nur hier. Der Name unten
    // MUSS mit ERWARTET in test/ndi-probe.mjs uebereinstimmen, aendert man den
    // einen, den anderen mitziehen.
    if (!s.open("JM Connect – Zoom Selbsttest")) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"videoSenderFailed\"}");
      ndiShutdown();
      std::fflush(stdout);
      TerminateProcess(GetCurrentProcess(), 1);
      return 1;
    }
    emitRaw("{\"ev\":\"ndiSelftest\",\"state\":\"sending\"}");
    // 150 statt 60 Durchlaeufe (~5 s statt ~2 s), GEMESSEN gegen
    // test/ndi-probe.mjs: die Quellensuche dort braucht allein bis zu
    // 8 * 250 ms = 2 s, und danach braucht die Empfangsphase noch Zeit fuer
    // Verbindungsaufbau + Poll-Schleife. Bei 2 s Sendezeit koennte die Quelle
    // schon wieder weg sein, BEVOR ueberhaupt der erste Frame abgeholt wird -
    // der Pruefstand meldete dann "kein Ton angekommen" fuer eine Quelle, die
    // tatsaechlich gesendet hat. Ein falscher Befund waere schlimmer als gar
    // kein Test.
    for (int i = 0; i < 150; ++i) {
      s.sendBlack(640, 360);
      // 10 ms Stille je Bild-Durchlauf. Der Selbsttest belegt damit BEIDE
      // Wege derselben Quelle - eine Quelle, die Bild wirbt und beim Ton
      // schweigt, saehe im Netz genauso aus wie eine funktionierende.
      s.sendSilence(480, 48000, 1);
      Sleep(33);
    }
    s.close();
    ndiShutdown();
    emitRaw("{\"ev\":\"ndiSelftest\",\"state\":\"done\"}");
    std::fflush(stdout);
    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
  }

  std::thread reader(readStdin);
  reader.detach();

  std::string line;
  while (!g_quit) {
    pumpOnce();
    // Schwarzbild-Herzschlag (Aufgabe 5): haelt jede Video-Quelle am Leben,
    // indem sie bei Bildausfall Schwarz statt eines eingefrorenen letzten
    // Bildes sendet. Hier und nicht in einem eigenen Thread - die Schleife
    // tickt bereits alle 10 ms, ein zweiter Thread waere nur ein weiterer
    // Schreiber auf denselben Feldern ohne jeden Vorteil.
    videoTick();
    while (!g_quit && nextLine(line)) handle(line);
    if (g_stdinClosed) {
      bool linesEmpty;
      {
        std::lock_guard<std::mutex> lock(g_mutex);
        linesEmpty = g_lines.empty();
      }
      if (linesEmpty) {
        // ACHTUNG, GEMESSEN: eine offene Anmeldung darf EOF nicht sofort
        // beenden lassen. sessionAuth() antwortet ASYNCHRON ueber
        // onAuthenticationReturn - ohne diese Pruefung bricht der Prozess ab,
        // sobald die Zeile "auth" verarbeitet ist und stdin zugeht, lange
        // bevor die Antwort da ist. Ohne diese Zeilen hat GENAU DAS die
        // {"ev":"auth",...}-Meldung deterministisch verschluckt: 3/3 Laeufen
        // ueber PowerShells Pipe und 5/5 Laeufen ueber Node child_process.spawn.
        //
        // Zehn Sekunden Obergrenze, damit eine tote Verbindung keine verwaiste
        // Bridge fuer immer am Leben haelt - dieselbe Sorge, die EOF ueberhaupt
        // erst als "quit" behandelt (siehe readStdin()). Laeuft die Frist ab,
        // OHNE dass die Antwort kam, wird das GEMELDET statt schweigend
        // aufzugeben - ein Warten, das stumm endet, waere genau der Haenger,
        // den dieses Vorhaben im Stage-0-Spike schon einmal 90 Sekunden lang
        // gesucht hat (ENABLE_CUSTOMIZED_UI_FLAG, siehe session.cpp).
        //
        // Task 7 bringt denselben Fall fuer den Beitritt: sessionJoin() setzt
        // seine Statusfolge ebenfalls ASYNCHRON ueber onMeetingStatusChanged ab
        // (siehe callbacks.cpp/session.cpp, sessionJoinPending()). Derselbe
        // Verschluck-Mechanismus, DERSELBE Code waere aber FALSCH: "joinTimeout"
        // gehoert bereits der TypeScript-Seite (bridge.ts misst dort, ob je ein
        // Endzustand erreicht wird - eine andere Frage als "kam ueberhaupt eine
        // Rueckmeldung, bevor der Prozess unter EOF wegstirbt"). Zwei
        // verschiedene Ursachen duerfen nie denselben Namen bekommen (Kernregel
        // der Spec) - der native Fall bekommt darum den EIGENEN Code
        // "joinEofTimeout". NICHT GEMESSEN (kein echtes Meeting verfuegbar ohne
        // Owner-Freigabe): ob die fuer "auth" gemessenen zehn Sekunden auch fuer
        // den Beitritt reichen - hier wiederverwendet, weil beides EOF-Notbremsen
        // fuer denselben Prozess sind, nicht weil die Zahl fuer "join" belegt waere.
        //
        // Aufgabe 8 (Teilnehmerliste) braucht KEIN eigenes "wartet noch"-Flag:
        // es gibt keinen "roster"-Befehl, die Liste feuert unaufgefordert als
        // Nebenwirkung der bereits hier geschuetzten Statusfolge - niemand
        // wartet auf eine Antwort, also kann EOF nichts verschlucken. Aufgabe 9
        // (Aufnahme-Erlaubnis) braucht die Pruefung dagegen SEHR WOHL und bekommt
        // sie hier: RequestLocalRecordingPrivilege() (checkPrivilege(), siehe
        // session.cpp) beantwortet sich ASYNCHRON ueber
        // onLocalRecordingPrivilegeRequestStatus - dieselbe Rennbedingung wie
        // bei "auth"/"join", derselbe Verschluck-Mechanismus, aber mit ihrem
        // EIGENEN Code "privilegeEofTimeout": weder "authTimeout" noch
        // "joinEofTimeout" waeren die richtige Ursache, und ein Sammelbegriff
        // wuerde die Suche beim naechsten Mal wieder an den falschen Ort
        // schicken (Kernregel der Spec: eine Ursache, ein Name). NICHT GEMESSEN
        // (kein echtes Meeting verfuegbar ohne Owner-Freigabe): ob diese
        // Rennbedingung hier tatsaechlich auftritt und ob dieselben zehn
        // Sekunden reichen - wiederverwendet aus demselben Grund wie bei
        // "joinEofTimeout": alle drei sind EOF-Notbremsen fuer denselben
        // Prozess, nicht weil die Zahl fuer "privilege" gemessen waere.
        const bool authOpen = sessionAuthPending();
        const bool joinOpen = sessionJoinPending();
        const bool privilegeOpen = sessionPrivilegePending();
        if (!authOpen && !joinOpen && !privilegeOpen) break;
        const ULONGLONG waitedMs = GetTickCount64() - g_stdinClosedAtMs;
        if (authOpen && waitedMs >= 10000) {
          emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":\"authTimeout\"}");
          emitLog(L"Zeitueberschreitung: EOF waehrend die Anmelde-Antwort noch offen war.");
          break;
        }
        if (joinOpen && waitedMs >= 10000) {
          emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":\"joinEofTimeout\"}");
          emitLog(L"Zeitueberschreitung: EOF waehrend die erste Beitritts-Statusmeldung noch offen war.");
          break;
        }
        if (privilegeOpen && waitedMs >= 10000) {
          emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":\"privilegeEofTimeout\"}");
          emitLog(L"Zeitueberschreitung: EOF waehrend die Antwort auf die Aufnahme-Erlaubnis noch offen war.");
          break;
        }
      }
    }
    // 10 ms: kurz genug, dass ein Befehl nicht spuerbar liegen bleibt, lang
    // genug, dass die Bridge im Leerlauf keinen Kern verheizt.
    Sleep(10);
  }

  // TRAGENDE REIHENFOLGE: erst alle Abos, DANN der Sitzungsabbau. Ein
  // laufender Renderer haelt eine Referenz auf den Meeting-Dienst - ihn nach
  // DestroyMeetingService abzubauen hiesse, auf abgeraeumten Zustand
  // zuzugreifen. Das ist dieselbe Fehlerklasse, die in Aufgabe 7 von Stage 1
  // als 0xC0000005 gemessen wurde.
  videoShutdownAll();
  const bool shutdownComplete = sessionShutdown();
  if (!shutdownComplete) {
    // Owner-Entscheidung, Abschluss-Sichtung Punkt A: sessionShutdown() hat
    // DestroyMeetingService/DestroyAuthService/CleanUPSDK uebersprungen, weil
    // sessionLeave() false lieferte (5-s-Pumpobergrenze abgelaufen, WAEHREND
    // der SDK-Thread nachweislich noch arbeitete - dieselbe Lage, in der der
    // Prozess in Aufgabe 7 GEMESSEN 5/5 mit 0xC0000005 endete. NACHGERECHNET
    // (Schluss-Pruefung dieser Runde): das damalige Protokoll enthielt "bye"
    // NACH der leaveTimeout-Zeile - der Abbau war also bereits zurueckgekehrt,
    // der Absturz kam auf dem REGULAEREN Ausstiegsweg danach, nicht
    // nachweislich in DestroyMeetingService selbst (siehe die Konstante
    // oben). "leaveTimeout" steht bereits auf stdout UND stderr (session.cpp,
    // vor der Rueckkehr aus sessionLeave()) - das ist die letzte verwertbare
    // Information vor dem Prozessende.
    //
    // KEIN {"ev":"bye"} hier: das waere eine Luege ueber einen sauberen
    // Abgang, den es in diesem Zweig nicht gab.
    //
    // Derselbe Ausstiegsweg wie unten fuer "InitSDK nie geglueckt", fuer
    // dasselbe Problem: TerminateProcess() ueberspringt DLL_PROCESS_DETACH
    // fuer ALLE angehaengten DLLs (dokumentiertes Verhalten) und damit den
    // Handler in der Zoom-SDK-DLL, der sonst Zustand voraussetzt, den der
    // uebersprungene Abbau hier NICHT hergestellt hat. EIGENER Rueckgabewert
    // (kLeaveNotSettledExitCode, siehe oben) statt 0: ein regulaeres Ende
    // UND dieser abgebrochene Abbau duerfen sich auf Prozessebene nicht
    // gleich anfuehlen - genau die Unterscheidung, die main() fuer den
    // InitSDK-Fall unten schon fuer 0 (weiterhin "alles gut") vs. den
    // regulaeren Absturzweg trifft.
    std::fflush(stdout);
    TerminateProcess(GetCurrentProcess(), kLeaveNotSettledExitCode);
    // ACHTUNG (Schluss-Pruefung, MINOR 3): TerminateProcess() ist dokumentiert
    // ASYNCHRON und liefert ein BOOL, das absichtlich nicht geprueft wird -
    // kehrte der Aufruf trotzdem je zurueck (oder schluege er fehl), darf die
    // Ausfuehrung NICHT in emitRaw("bye")/return 0 unten weiterlaufen, das
    // sind genau die beiden Dinge, die dieser Zweig verbietet. Eigener Riegel
    // statt Rueckgabewert-Pruefung: return beendet main() hier auf jeden Fall,
    // mit demselben Exitcode, den TerminateProcess ohnehin haette setzen
    // sollen - schlimmstenfalls (TerminateProcess kehrt zurueck) ein
    // regulaerer ExitProcess-Ausstieg mit kLeaveNotSettledExitCode statt ein
    // harter Abbruch, nie ein stillschweigendes Durchfallen in den bye-Pfad.
    return kLeaveNotSettledExitCode;
  }

  emitRaw("{\"ev\":\"bye\"}");

  if (!g_sdkInitialized) {
    // ACHTUNG: Wenn InitSDK in diesem Lauf NIE geglueckt ist (Bediener bricht
    // vor "init" ab, stdin schliesst ohne Daten, InitSDK schlaegt fehl), endet
    // der REGULAERE Prozessausstieg mit einem Absturz: gemessen 0xC0000409
    // (3221226505), deterministisch - unabhaengig davon, ob ueberhaupt eine
    // SDK-Funktion aufgerufen wurde. Ursache ist ein DLL_PROCESS_DETACH-
    // Handler in der Zoom-SDK-DLL, der Zustand voraussetzt, den nur InitSDK
    // anlegt; beim regulaeren Prozessende (ExitProcess) wird dieser Handler
    // fuer jede angehaengte DLL aufgerufen und stuerzt hier ab.
    // Gemessen wurden zwei Kandidaten, die diesen Handler umgehen sollen (fuenf
    // Faelle je Kandidat, ueber child_process.spawn ohne angehaengtes
    // Zeilenende - siehe task-5-report.md):
    //   - std::quick_exit(0): laeuft am Ende trotzdem durch ExitProcess - im
    //     Fall "stdin sofort zu, keine Daten" weiterhin exit=3221226505
    //     (0xC0000409), der Absturz blieb bestehen.
    //   - TerminateProcess(): ueberspringt DLL_PROCESS_DETACH fuer ALLE
    //     angehaengten DLLs (dokumentiertes Verhalten) - alle fuenf Faelle
    //     exit=0.
    // Dieser Umweg betrifft NUR den Fall "InitSDK nie geglueckt". Ein Lauf MIT
    // geglueckter Initialisierung nimmt weiterhin den regulaeren `return 0`
    // unten - sonst wuerde ein spaeterer ECHTER Absturz kuenftig
    // stillschweigend als Erfolg gemeldet, und das waere schlimmer als der
    // jetzige Zustand. Die Ausgabe steht vorher vollstaendig: emitRaw()
    // spuelt bereits selbst, das fflush() hier ist zusaetzliche Absicherung.
    std::fflush(stdout);
    TerminateProcess(GetCurrentProcess(), 0);
  }

  // Ganz am Ende, NACH sessionShutdown() und VOR dem return - NICHT auf dem
  // TerminateProcess-Zweig oben (nicht beruhigter Abbau, kLeaveNotSettledExitCode):
  // dort wird der Prozess ohnehin hart beendet, und ein weiterer Aufruf auf
  // halb abgeraeumtem Zustand waere genau das Risiko, das dieser Zweig
  // vermeidet. Dieser Punkt hier wird nur auf dem regulaeren Ausstiegsweg
  // erreicht.
  ndiShutdown();

  return 0;
}
