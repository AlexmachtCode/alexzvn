// zoom-bridge.exe - Stage 1.
//
// EIN Thread pumpt die Win32-Nachrichten (ohne sie kommt kein SDK-Rueckruf an),
// EIN Thread liest stdin. Der Leser legt fertige Zeilen in eine Warteschlange,
// der Hauptthread arbeitet sie zwischen zwei Pumprunden ab. Alle SDK-Aufrufe
// passieren damit auf demselben Thread, der auch pumpt.
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <cstdio>
#include <windows.h>
#include "emit.h"
#include "session.h"

namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
volatile bool g_stdinClosed = false;
volatile bool g_quit = false;

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
  // EOF heisst quit. Stirbt die aufrufende Seite, darf keine verwaiste Bridge
  // in einem fremden Meeting sitzen bleiben.
  g_stdinClosed = true;
}

bool nextLine(std::string& out) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_lines.empty()) return false;
  out = g_lines.front();
  g_lines.pop_front();
  return true;
}

void handle(const std::string& line) {
  const std::string cmd = cmdOf(line);
  if (cmd.empty()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"parse\",\"code\":\"badJson\"}");
    return;
  }
  if (cmd == "init") {
    sessionInit();
    return;
  }
  if (cmd == "quit") {
    g_quit = true;
    return;
  }
  // auth/join/leave kommen in Task 6 und 7.
  emitRaw("{\"ev\":\"error\",\"where\":\"" + cmd + "\",\"code\":1}");  // SDKERR_NO_IMPL
}

}  // namespace

int main() {
  std::thread reader(readStdin);
  reader.detach();

  std::string line;
  while (!g_quit) {
    pumpOnce();
    while (!g_quit && nextLine(line)) handle(line);
    if (g_stdinClosed) {
      std::lock_guard<std::mutex> lock(g_mutex);
      if (g_lines.empty()) break;
    }
    // 10 ms: kurz genug, dass ein Befehl nicht spuerbar liegen bleibt, lang
    // genug, dass die Bridge im Leerlauf keinen Kern verheizt.
    Sleep(10);
  }

  sessionShutdown();
  emitRaw("{\"ev\":\"bye\"}");
  return 0;
}
