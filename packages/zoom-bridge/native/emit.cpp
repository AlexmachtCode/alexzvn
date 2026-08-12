#include "emit.h"
#include <cstdio>
#include <windows.h>

void emitRaw(const std::string& json) {
  // fwrite statt printf: der JSON-Text darf Prozentzeichen enthalten.
  //
  // EIN Schreibaufruf fuer Text UND Zeilenende, nicht fwrite+fputc.
  // Das Zoom-SDK schreibt SELBST auf stdout (`getServiceHub` unmittelbar nach
  // InitSDK - im Stage-0-Spike gemessen, in README.md Abschnitt 6 festgehalten,
  // im ersten Owner-Lauf erneut aufgetreten). stdout ist damit nachweislich
  // KEIN Kanal, auf dem wir allein sind. Zwei getrennte CRT-Aufrufe sind einzeln
  // gesperrt, aber nicht GEMEINSAM: zwischen Text und '\n' passt eine fremde
  // Ausgabe, und dann klebt Fremdtext mitten in einer Ereigniszeile - aus
  // einer lesbaren Zeile wuerden zwei unlesbare. Ein Aufruf schliesst dieses
  // Fenster fuer unsere eigene Zeile. Eine EIGENSTAENDIGE Fremdzeile bleibt
  // moeglich und ist bereits versorgt: bridge.ts meldet sie als "unlesbare
  // Zeile" und faehrt fort (nichts verschwindet still).
  std::string line = json;
  line += '\n';
  std::fwrite(line.data(), 1, line.size(), stdout);
  // Ohne fflush haengt die Zeile im Puffer, bis er voll ist - die aufrufende
  // Seite saehe minutenlang nichts und hielte die Bridge fuer tot.
  std::fflush(stdout);
}

void emitLog(const std::wstring& text) {
  std::fwprintf(stderr, L"%s\n", text.c_str());
  std::fflush(stderr);
}

std::string jsonEscape(const std::wstring& s) {
  const int need = WideCharToMultiByte(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0, nullptr, nullptr);
  std::string utf8(static_cast<size_t>(need), '\0');
  if (need > 0) {
    WideCharToMultiByte(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), utf8.data(), need, nullptr, nullptr);
  }

  std::string out;
  out.reserve(utf8.size() + 8);
  for (const unsigned char c : utf8) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b";  break;
      case '\f': out += "\\f";  break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if (c < 0x20) {
          char buf[7];
          std::snprintf(buf, sizeof(buf), "\\u%04x", c);
          out += buf;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  return out;
}
