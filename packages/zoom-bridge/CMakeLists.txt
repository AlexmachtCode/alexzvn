# zoom-bridge.exe - eigenstaendiges Windows-Programm, KEIN Node-Addon.
# Deshalb CMake und nicht binding.gyp: node-gyp ist auf .node-Ausgabe und
# Electron-ABI verdrahtet und passt hier nicht.
cmake_minimum_required(VERSION 3.20)
project(zoom_bridge CXX)

if(NOT WIN32)
  message(FATAL_ERROR "zoom-bridge ist Windows-only.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT DEFINED ENV{ZOOM_SDK_DIR})
  message(FATAL_ERROR "ZOOM_SDK_DIR ist nicht gesetzt.")
endif()
file(TO_CMAKE_PATH "$ENV{ZOOM_SDK_DIR}" ZOOM_SDK_DIR)

set(ZOOM_HEADERS "${ZOOM_SDK_DIR}/x64/zoom_sdk_c_sharp_wrap/h")
if(NOT EXISTS "${ZOOM_HEADERS}/zoom_sdk.h")
  message(FATAL_ERROR "zoom_sdk.h nicht gefunden unter ${ZOOM_HEADERS}")
endif()

# Von scripts/make-implib.mjs erzeugt, liegt im Paketwurzelverzeichnis.
set(ZOOM_IMPLIB "${CMAKE_CURRENT_SOURCE_DIR}/sdk.lib")
if(NOT EXISTS "${ZOOM_IMPLIB}")
  message(FATAL_ERROR "sdk.lib fehlt - erst `node scripts/make-implib.mjs` laufen lassen.")
endif()

add_executable(zoom-bridge
  native/main.cpp
  native/emit.cpp
)

target_include_directories(zoom-bridge PRIVATE "${ZOOM_HEADERS}")
# user32: die Bridge pumpt selbst Win32-Nachrichten (PeekMessage/Dispatch) -
# ohne eigene Schleife kommt kein einziger SDK-Rueckruf an.
target_link_libraries(zoom-bridge PRIVATE "${ZOOM_IMPLIB}" user32)
target_compile_definitions(zoom-bridge PRIVATE UNICODE _UNICODE WIN32)
