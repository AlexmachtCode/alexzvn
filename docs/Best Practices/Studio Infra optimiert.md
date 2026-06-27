```
# Studio Infrastruktur – Technik Wiki
*Stand: aktuellste interne Dokumentation*
```

```
---
```

```
## Übersicht
Dieses Dokument beschreibt die vollständige technische Infrastruktur des
Studios:
Licht, Video, Audio, Netzwerk, Routing, PTZ‑Kameras, Funkstrecken, Stageboxen
und relevante Referenzen.
```

```
Es dient als zentrale Wissensbasis für:
- Media Operator
- Bildtechnik
- Audiotechnik
- Projektleitung
- Externe Techniker
```

```
---
```

```
# 1. Licht
```

```
## 1.1 Ausstattung
- **14× Aputure Nova P300C** (Softboxen, Snapgrid)
- **2× Aputure LS300X** (Softbox, Lantern)
- **4× Aputure LS60X**
- **3× 1×1 Lightpanel**
- **1× Eurolite ArtNet Node IV**
## 1.2 Steuerung
- **QLC+ (QLight Controller Plus)**
  → DMX‑Steuerung über ArtNet Node
```

```
## 1.3 Dokumente
- Aputure Nova P300C Manual
- Aputure LS300X Manual
```

```
---
```

```
# 2. Video
## 2.1 PTZ‑Kameras
### Modelle
- **3× Panasonic AW‑UE150**
- **1× Panasonic AW‑UE100**
- **1× Panasonic AW‑RP150 Remote Panel**
### IP‑Adressen
| Kamera | IP-Adresse |
|--------|------------|
| Kam 1 | 192.168.10.20 |
| Kam 2 | 192.168.10.21 |
| Kam 3 | 192.168.10.22 |
| Kam 4 | 192.168.10.23 |
### Steuerung
- PTZ Control Center (Software)
- AW‑RP150 Remote Panel (Keller)
- Stromversorgung via **PoE++ Injector** (Serverschrank)
```

```
---
```

```
## 2.2 Bildmischer & Routing
```

```
### TriCaster
- **NewTek TriCaster 2 Elite**
- Control Surface
- Alle Signale liegen auf der Kreuzschiene
### AJA Kumo 3232‑12G
- **32×32 SDI‑Kreuzschiene**
- IP: **192.168.10.150**
- Salvos konfiguriert (Standard, Salvo 2–8)
### Beispiel‑Routing (Auszug)
**Sources:**
- CAM Top IN 1–4
- TC OUT 1–8
- Unreal OUT 1–8
- LiveU Ingest 1–4
- Rack Studio IN 1–2
**Destinations:**
- TC IN 1–8
- Monitor OUT 1–4
- Unreal IN 1–8
- Rack Studio OUT 1–2
---
## 2.3 Monitore & Zuspieler
- **2× NEC Multisync M551 55"** (entspiegelt)
- **4× Lenovo Thinkcenter** (Content)
- **2× Lenovo P‑340** (Control)
- **1× LiveU LU‑2000** (Decoder)
---
## 2.4 Cine‑ & Studio‑Kameras
- **Blackmagic URSA Mini Pro 12K** (PL, DZO/Tamron Optiken)
- **Sony PXW‑FS5** (E‑Mount, 24–105mm f4, Metabones E→EF)
- **Sony Alpha 7c** (Fullframe, 24–105mm)
---
## 2.5 Unreal Engine / Virtual Production
- Unreal Engine Workstation
- Blackmagic Decklink Duo
- Decklink 4K Extreme
- Referenzen:
  - Unreal Referenzprojekt Studio
  - UDP‑Tracking & Aximmetry
  - Urban Studio Basic Setup
---
# 3. Audio
## 3.1 Mischpult & Monitoring
- **Allen & Heath SQ‑5**
- **Sennheiser HD‑25**
- **2× Fostex 6301DT** (Regie)
### Verkabelung (Auszug)
- 2× XLR Main Out → SQ5 Input 1 & 2
- 2× XLR Main In → SQ5 Output 1 & 2
- Dante Receive: **15 & 16**
```

```
---
```

```
## 3.2 Funkstrecke – SHURE ULXD
- **2× ULXD4D** Dual‑Empfänger
- **4× UA8** Rundstrahler
- **4× UA874** aktive Richtantennen
- **4× ULXD1 H51** Taschensender
- **4× ULXD2 B87A** Handsender
- **4× DPA 4288 Headsets**
```

```
---
```

```
## 3.3 Stagebox
- **Allen & Heath AB168 Stagebox**
- Dokumente:
  - Getting Started Guide
  - Technical Datasheet
  - Weights & Dimensions
---
# 4. Netzwerk
## 4.1 VLAN‑Struktur
- **NDI VLAN**
- **Dante VLAN**
- **Ubiquiti VLAN**
- Weitere Details im internen Netzwerk‑Sheet
## 4.2 Netzwerkübersicht
→ Google Sheet (IP‑Ranges, Routing, VLAN‑Zuordnung)
```

```
---
```

```
# 5. Workflows & Produktionen
```

```
## 5.1 Referenzproduktionen
- AstraZeneca (Google Drive)
- FischerAppelt (Google Drive)
```

```
## 5.2 Interne Ressourcen
- TriCaster Hands‑On Projekt
- JM Technik Wiki
- Technikausleihe / Defekte Geräte (QR‑Code‑System)
```

```
---
```

```
# 6. Zusammenfassung
Das Studio verfügt über eine vollständig integrierte Broadcast‑ und
Virtual‑Production‑Infrastruktur mit:
```

- `Hochwertigem Licht‑Setup (Aputure) - PTZ‑ und Cine‑Kameras (Panasonic, Sony, Blackmagic) - 32×32 SDI‑Routing (AJA Kumo) - TriCaster 2 Elite als zentrale Live‑Produktion - Dante‑basiertem Audio‑System (SQ‑5, Shure ULXD) - Unreal Engine für Virtual Production - VLAN‑basiertem Netzwerkdesign` 

- `Dokumentierten Workflows & Referenzen` 

```
Dieses Dokument dient als **zentrale technische Wissensbasis** für alle
Studio‑Produktionen.
```

