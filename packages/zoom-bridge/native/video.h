#pragma once
#include <string>
// ABWEICHUNG VOM BRIEF-WORTLAUT, GEMESSEN: dieselbe Uebersetzungsfalle wie in
// session.h/callbacks.h - zoom_sdk_def.h setzt HWND unter WIN32 als bereits
// bekannt voraus und typedef't es selbst nur im Nicht-WIN32-Zweig. video.cpp
// bindet video.h als ERSTEN Header ein (siehe dort), dieser Header muss darum
// selbst dafuer sorgen, dass windows.h VOR jedem Zoom-Header steht - ohne
// diese Zeile bricht der Bau mit derselben C3646/C4430/C2872-Kaskade ab, die
// dort bereits dokumentiert ist (hier tatsaechlich reproduziert: `npm run
// rebuild -w @jm/zoom-bridge` scheiterte ohne diese Zeile an genau dieser
// Kaskade in video.cpp).
#include <windows.h>
#include "zoom_sdk.h"
#include "rawdata/rawdata_renderer_interface.h"

USING_ZOOM_SDK_NAMESPACE

/** Wandelt "720p" in ZoomSDKResolution_720P. false = unbekannter Schluessel. */
bool videoParseResolution(const std::string& key, ZoomSDKResolution* out);

/**
 * Abonniert das Video eines Teilnehmers und legt dafuer einen NDI-Sender an.
 * Meldet Erfolg und jeden Fehlschlag SELBST auf stdout - der Aufrufer
 * bekommt keinen Rueckgabewert, den er vergessen koennte.
 */
void videoSubscribe(unsigned int userId, ZoomSDKResolution res);

/** Baut ein Abo ab. Meldet ebenfalls selbst. */
void videoUnsubscribe(unsigned int userId);

/**
 * Baut ALLE Abos ab. MUSS vor sessionLeave() laufen - ein laufender
 * Renderer haelt eine Referenz auf den Meeting-Dienst.
 */
void videoShutdownAll();

/**
 * Schwarzbild-Herzschlag: von der Hauptschleife alle 10 ms gerufen (siehe
 * main.cpp, direkt nach pumpOnce()). Faellt der Bildstrom eines Abos aus
 * (Kamera aus, Teilnehmer weg, Aussetzer), sendet dieses Abo statt eines
 * eingefrorenen letzten Bildes fortlaufend Schwarz - die NDI-Quelle bleibt
 * bestehen, statt zu verschwinden. Ein verschwindender Sender waere im
 * Livebetrieb die gefaehrlichere Wahl: laege er auf Programm, risse er weg.
 * Der Wechsel wird zusaetzlich als Ereignis gemeldet (state "black"), damit
 * die Regie ihn SIEHT statt ihn zu erraten.
 */
void videoTick();
