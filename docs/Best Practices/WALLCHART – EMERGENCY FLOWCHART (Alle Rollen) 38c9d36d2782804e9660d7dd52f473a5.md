# WALLCHART – EMERGENCY FLOWCHART (Alle Rollen)

*Jakobs Medien GmbH – Media Operations*

---

# 🎥 VIDEO OPERATOR (TriCaster / PTZ / Kumo)

[CRITICAL] Backup-Bild aktivieren (Fallback Input)

→ FEHLERTYP:

**KEIN BILD**

- [CRITICAL] Kumo Salvo „Standard“ laden
- [HIGH] SDI prüfen
- [HIGH] TriCaster Input neu setzen

**FALSCHES BILD**

- [HIGH] Routing prüfen
- [HIGH] Unreal/PTZ prüfen

**PTZ AUSFALL**

- [HIGH] Auf andere Kamera schalten
- [HIGH] PoE++ prüfen
- [HIGH] IP prüfen (192.168.10.xx)

**UNREAL AUSFALL**

- [HIGH] Auf Standard-Kamera schalten
- [MEDIUM] Decklink Output prüfen
- [MEDIUM] Szene neu laden
- [MEDIUM] Routing zur Kumo prüfen

---

# 🎚️ AUDIO OPERATOR (SQ‑5 / Dante / Funk)

[CRITICAL] Backup-Audio aktivieren (Backup Mix / Handsender)

→ FEHLERTYP:

**KEIN TON**

- [CRITICAL] SQ‑5 Input prüfen
- [HIGH] Fader hoch / Mute aus
- [HIGH] Dante 15/16 prüfen

**ÜBERSTEUERT**

- [HIGH] Gain reduzieren
- [HIGH] Sender-Gain prüfen
- [HIGH] Headset korrekt setzen

**FUNK AUSFALL**

- [HIGH] Backup-Handsender geben
- [HIGH] Frequenz wechseln
- [HIGH] Sender koppeln

**DANTE AUSFALL**

- [MEDIUM] Dante Controller öffnen
- [MEDIUM] Clock Master prüfen
- [MEDIUM] Patchplan neu laden
- [MEDIUM] SQ‑5 neu starten

---

# 💡 LICHT OPERATOR (Aputure / QLC+ / DMX)

[CRITICAL] Kamera ISO/Gain erhöhen (Notfall-Licht)

→ FEHLERTYP:

**LICHT AUS**

- [CRITICAL] QLC+ neu starten
- [HIGH] ArtNet Node prüfen