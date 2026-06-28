---
id: sop-studio-jm
title: "SOP — Studiobetrieb JM"
category: Best Practices
difficulty: anspruchsvoll
tags: [sop, studio, media-operations, workflow]
relatedTools: []
prerequisites: []
setupTimeMin: 0
teamSize: "—"
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Standard Operating Procedure für den JM-Studiobetrieb — Rollen, Phasen von Vorbereitung bis Post-Production, Sicherheit und Troubleshooting."
---

# Standard Operating Procedure (SOP) – Studiobetrieb

*Jakobs Medien GmbH – Media Operations*

---

## 1. Zweck der SOP

Diese SOP definiert den standardisierten Ablauf für den Betrieb des Studios.
Sie stellt sicher, dass alle Produktionen konsistent, sicher und mit hoher
Qualität durchgeführt werden.

---

## 2. Geltungsbereich

Diese SOP gilt für:

- Media Operator
- Bildtechnik
- Audiotechnik
- Lichttechnik
- Projektleitung
- Externe Techniker im Studio

---

## 3. Rollen & Verantwortlichkeiten

### 3.1 Media Operator

- Gesamtüberblick über Bild, Ton, Licht, Routing
- Bedienung TriCaster & PTZ
- Monitoring aller Signale
- Kommunikation mit Regie & Projektleitung

### 3.2 Bildtechnik

- Kameras (PTZ, Cine)
- Kreuzschiene (AJA Kumo)
- Monitore & Zuspieler
- Unreal Engine / Virtual Production

### 3.3 Audiotechnik

- SQ‑5 Mischpult
- Dante‑Routing
- Funkstrecken (Shure ULXD)
- Monitoring & Pegelkontrolle

### 3.4 Lichttechnik

- Aputure‑Leuchten
- QLC+ / DMX‑Steuerung
- Lichtstimmungen & Szenen

---

## 4. Ablauf – Gesamtprozess

### Phase 1 – Vorbereitung (T‑60 bis T‑30 Minuten)

#### 4.1 Studio öffnen & Grundcheck

- Studio stromseitig aktiv
- Netzwerk aktiv (Switches, VLANs, PoE++)
- Kreuzschiene erreichbar (192.168.10.150)
- TriCaster gestartet
- SQ‑5 gestartet
- Unreal Workstation gestartet
- Lichtsystem aktiv (QLC+, ArtNet Node)

#### 4.2 Geräteprüfung

- PTZ‑Kameras erreichbar (Ping)
- Cine‑Kameras liefern SDI‑Signal
- Funkstrecken geladen & verbunden
- Monitore aktiv
- Audio‑Monitoring aktiv

---

### Phase 2 – Technische Einrichtung (T‑30 bis T‑10 Minuten)

#### 4.3 Routing konfigurieren

- Kumo Salvo „Standard“ laden
- PTZ‑Inputs → TriCaster
- Unreal OUT → TriCaster
- LiveU Ingest → TriCaster
- Monitor OUT → NEC M551

#### 4.4 TriCaster Setup

- Session laden
- Inputs benennen
- Audio‑Metering prüfen
- Streaming‑Profile prüfen
- Recording‑Pfad prüfen

#### 4.5 Audio Setup

- Dante‑Routing prüfen
- SQ‑5 Patchplan prüfen
- Headsets & Handsender testen
- Pegel einrichten (−12 dBFS Zielwert)

#### 4.6 Licht Setup

- Keylight / Fill / Backlight setzen
- Szenen laden
- DMX‑Universen prüfen

#### 4.7 Unreal Setup

- Szene laden
- Tracking aktiv
- Decklink‑Outputs prüfen
- Routing zur Kumo prüfen

---

### Phase 3 – Pre‑Production (T‑10 bis T‑0 Minuten)

#### 4.8 Letzter Systemcheck

- Bild stabil
- Ton stabil
- Licht korrekt
- PTZ‑Presets geladen
- Streaming bereit
- Recording bereit
- Backup‑Recording aktiv

#### 4.9 Kommunikation

- Regie informiert
- Projektleitung informiert
- Moderation / Gäste verkabelt
- Letzter Audio‑Check

---

### Phase 4 – Live‑Produktion

#### 4.10 Während der Produktion

- Monitoring aller Signale
- Audio‑Metering im Blick
- PTZ‑Bewegungen smooth
- Szenenwechsel im TriCaster
- Unreal‑Render überwachen
- NDI‑Stabilität prüfen
- Backup‑Recording prüfen

#### 4.11 Troubleshooting (Schnellmaßnahmen)

- **Kein Bild:** Kumo Routing prüfen
- **Kein Ton:** SQ‑5 Patch / Dante prüfen
- **PTZ offline:** PoE++ / IP / Control Center
- **Unreal kein Signal:** Decklink / Routing
- **NDI instabil:** VLAN / Switch / Bandbreite

---

### Phase 5 – Post‑Production

#### 4.12 Nach der Produktion

- Recordings sichern
- Streaming stoppen
- TriCaster Session speichern
- Routing zurück auf „Standard“
- Funkstrecken ausschalten
- Licht ausschalten
- Studio zurückbauen

#### 4.13 Dokumentation

- Fehler dokumentieren
- Besonderheiten notieren
- Lessons Learned eintragen
- Technik‑Wiki aktualisieren

---

## 5. Sicherheitsrichtlinien

### 5.1 Elektrik

- Keine Lasten an Mehrfachsteckdosen
- Kabelwege frei halten
- USV nicht überlasten

### 5.2 Netzwerk

- Keine Fremdgeräte ohne Freigabe
- VLAN‑Trennung beachten
- IP‑Konflikte vermeiden

### 5.3 Audio

- Pegel nicht über 0 dBFS
- Headsets hygienisch reinigen

### 5.4 Video

- SDI‑Kabel nicht knicken
- PTZ‑Bewegungen langsam fahren

---

## 6. Anhänge

### 6.1 Checklisten

→ Verlinkte Checkliste „Studio Checkliste – Betrieb & Vorbereitung“
