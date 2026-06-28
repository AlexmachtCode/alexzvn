---
id: studio-infrastruktur
title: "Studio-Infrastruktur"
category: Best Practices
difficulty: anspruchsvoll
setupTimeMin: 0
teamSize: "—"
tags: [infrastruktur, studio, licht, netzwerk]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Überblick über die technische Infrastruktur des Studios — Licht, Video, Audio und Netzwerk."
---

# Studio Infrastruktur

# Studio Infrastruktur – Zusammenfassung

*Basierend auf der internen Dokumentation (Stand: 09.12.2023)*

---

## 1. Allgemeines

- Dokument erstellt von: **Alexander Kurreck**
- Letzte Bearbeitung: **Alexander Kurreck**
- Inhalt: Übersicht über Licht-, Video-, Audio- und Netzwerk-Infrastruktur des Studios sowie Referenzen und Workflows.

---

# 2. Licht

## 2.1 Ausstattung

- **14× Aputure Nova P300C** (mit Softboxen & Snapgrid)
- **2× Aputure LS300X** (Softbox, Lantern)
- **4× Aputure LS60X**
- **3× 1×1 Lightpanel**
- **1× Eurolite ArtNet Node IV**

## 2.2 Steuerung

- **QLC+ (QLight Controller Plus)** für DMX‑Steuerung

## 2.3 Referenzen / Manuals

- Aputure Nova P300C Manual
- Aputure LS300X Manual

---

# 3. Video

## 3.1 Kamera-Setup

- **3× Panasonic AW‑UE150 (PTZ)**
- **1× Panasonic AW‑UE100 (PTZ)**
- **1× Panasonic AW‑RP150 Remote Panel**
- **IP-Adressen der PTZ-Kameras:**
    - Kam 1: 192.168.10.20
    - Kam 2: 192.168.10.21
    - Kam 3: 192.168.10.22
    - Kam 4: 192.168.10.23
- Steuerung:
    - PTZ Control Center (Software)
    - AW‑RP150 Remote (Keller)
- Stromversorgung:
    - PoE++ Injector (Serverschrank)

## 3.2 Bildmischer & Routing

- **NewTek TriCaster 2 Elite** + Control Surface
- **AJA Kumo 32×32 12G Kreuzschiene**
    - IP: **192.168.10.150**
    - Alle Inputs/Outputs frei routbar
    - Salvos konfiguriert (Standard, Salvo 2–8)

### 3.2.1 Kumo – Beispielbelegung (Auszug)

- CAM Top IN 1–4
- TC OUT 1–8
- Unreal OUT 1–8
- LiveU Ingest 1–4
- Rack Studio IN/OUT 1–2
- Monitor OUT 1–4

## 3.3 Monitore & Zuspieler

- **2× NEC Multisync M551 55"** (entspiegelt, Bodenständer)
- **4× Lenovo Thinkcenter** (Content)
- **2× Lenovo P‑340** (Control)
- **1× LiveU LU‑2000** (Decoder)

## 3.4 Cine- & Studio-Kameras

- **Blackmagic URSA Mini Pro 12K** (PL, DZO/Tamron Optiken)
- **Sony PXW‑FS5** (E‑Mount, 24–105mm f4, Metabones E→EF)
- **Sony Alpha 7c** (Fullframe, 24–105mm)

## 3.5 Unreal Engine / Schnitt

- Unreal Engine Rechner
- Blackmagic Decklink Duo
- Decklink 4K Extreme

## 3.6 Referenzen

- Unreal Referenzprojekt Studio
- UDP‑Tracking & Aximmetry
- Urban Studio Basic Setup

---

# 4. Audio

## 4.1 Mischpult & Monitoring

- **Allen & Heath SQ‑5**
- **Sennheiser HD‑25**
- **2× Fostex 6301DT** (Regie)

### 4.1.1 Verkabelung (Auszug)

- 2× XLR Main Out → SQ5 Input 1 & 2
- 2× XLR Main In → SQ5 Output 1 & 2
- Dante Receive: **15 & 16**

## 4.2 Funkstrecke – SHURE ULXD

- **2× ULXD4D** Dual‑Empfänger
- **4× UA8** Rundstrahler
- **4× UA874** aktive Richtantennen
- **4× ULXD1 H51** Taschensender
- **4× ULXD2 B87A** Handsender
- **4× DPA 4288 Headsets**

## 4.3 Stagebox

- Allen & Heath AB168 Stagebox
- Manuals & Datasheets verlinkt

---

# 5. Netzwerk

- Interne Netzwerkübersicht:
    
    Google Sheet (VLANs, IP‑Ranges, Routing)
    
- VLANs (aus Dokument ersichtlich, aber nicht ausgefüllt):
    - NDI VLAN
    - Dante VLAN
    - Ubiquiti VLAN

---

# 6. Bisherige Produktionen & Workflows

## 6.1 AstraZeneca Produktion

- Referenzvideo / Workflow-Dokument (Google Drive)

## 6.2 FischerAppelt Produktion

- Referenzvideo / Workflow-Dokument (Google Drive)

---

# 7. Technikausleihe / Defekte Geräte

- QR‑Code‑basierte Übersicht (PDF verlinkt)
- Interne Tools:
    - TriCaster Hands‑On Projekt
    - JM Technik Wiki

---

# 8. Externe Dokumente & Manuals (Auszug)

- Aputure Manuals
- Panasonic AW‑UE150 / AW‑RP150 Manuals
- TriCaster Software Update Guide
- Allen & Heath SQ‑5 Manuals
- AB168 Stagebox Manuals
- Unreal Engine Referenzen

---

# 9. Zusammenfassung (Kurz)

Das Studio verfügt über eine **voll ausgestattete Broadcast‑ und Virtual‑Production‑Infrastruktur**, bestehend aus:

- **Hochwertigem Licht‑Setup** (Aputure)
- **PTZ‑ und Cine‑Kameras** (Panasonic, Sony, Blackmagic)
- **Professionellem Routing** (AJA Kumo 32×32)
- **TriCaster 2 Elite** als zentrale Live‑Produktionseinheit
- **Dante‑basiertem Audio‑System** (SQ‑5, Shure ULXD)
- **Unreal Engine** für Virtual Production
- **Strukturiertem Netzwerk** mit VLAN‑Trennung
- **Dokumentierten Workflows** für vergangene Produktionen

Dieses Dokument dient als **technische Übersicht** für Operator, Techniker und Projektplanung.
