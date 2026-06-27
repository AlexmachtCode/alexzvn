# Unreal / Virtual Production – Emergency Flowchart

```
                     ┌──────────────────────────┐
                     │   UNREAL-PROBLEM IM LIVE  │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 0–5 SEK: AUF KAMERA GEHEN│
                     │ (Fallback Bild)          │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP?                  │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ KEIN SIGNAL     │   │ TRACKING AUSFALL │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Decklink Output prüfen       │   │ UDP-Port prüfen              │
    │ Routing zur Kumo prüfen      │   │ Tracking-Software aktiv?     │
    │ Szene neu laden              │   │ Kamera-ID prüfen             │
    │ Unreal neu starten           │   │ Netzwerk prüfen              │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐
                 │ UNREAL CRASH    │
                 └───────┬─────────┘
                         │
                         ▼
    ┌──────────────────────────────┐
    │ Projekt neu laden            │
    │ GPU-Auslastung prüfen        │
    │ Decklink deaktivieren/aktiv. │
    │ Unreal neu starten           │
    └──────────────────────────────┘
```