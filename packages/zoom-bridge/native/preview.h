#pragma once
// Vorschau-Modul der Slots (Spec 6.16, E14-E16, Nachbesserung B18).
//
// THREAD-REGEL (6.1): ein festes Feld g_vorschau[16] (preview.cpp), ein Platz je
// Slot-Nummer, je Platz eine eigene Sperre. Der Bild-Rueckruf (SDK-Thread) schreibt
// per try_lock in den Platz seines Slots, der Vorschau-Thread liest NUR diese Plaetze
// - nie g_slots, nie ein Feld eines Slots. Die Plaetze leben so lange wie der Prozess;
// ein Slot meldet seinen Platz bei slotOn an und VOR dem Loeschen ab.
//
// Bewusst ohne Zoom- und ohne Slot-Typen: das Bild kommt als I420-Puffer.
#include <cstddef>
#include <cstdint>

/** Platz nr (1..16) aktiv, Puffer leer. Bei slotOn. */
void vorschauAnmelden(int nr);

/** Platz nr inaktiv, Puffer leer. Bei slotOff und in jeder Abbau-Kette VOR dem Loeschen. */
void vorschauAbmelden(int nr);

/** Puffer leer, Platz bleibt aktiv. Beim Umhaengen (6.10 Schritt 6). */
void vorschauLeeren(int nr);

/**
 * Ein ECHTES Bild des Slots (Bild-Rueckruf, SDK-Thread): nur bei previewMode on,
 * hoechstens eins je 500 ms und Slot, in 192 x 108 eingepasst (Seitenverhaeltnis bleibt),
 * Punktauswahl aus Y, U, V nach BGR. Per try_lock - ist der Platz belegt, faellt dieses
 * Bild aus. Kosten in vorschauKostenUs(nr).
 */
void vorschauBild(int nr, unsigned ziel, const uint8_t* i420, int w, int h, int64_t jetzt);

/**
 * previewMode (6.2): an startet den Vorschau-Thread (COM als MTA, WIC), aus haelt ihn
 * an. Meldet die Bestaetigung {"ev":"previewMode","on":...}. Laesst sich WIC oder COM
 * nicht einrichten: einmal previewUnavailable mit HRESULT, Vorschau bleibt aus.
 */
void vorschauModus(bool an);

/** quit/EOF: Vorschau-Thread beenden, VOR dem Loeschen der Slots (6.15). */
void vorschauThreadEnde();

/** Ob die Vorschau an ist (bridgeStats.previewOn). */
bool vorschauAn();

/** Kosten des Platzes in Mikrosekunden seit dem letzten Abholen (slotStats.previewUs); setzt zurueck. */
uint64_t vorschauKostenUs(int nr);

/** Belegter Speicher des Platzes in Byte (slotStats.memKb). */
size_t vorschauSpeicherBytes(int nr);
