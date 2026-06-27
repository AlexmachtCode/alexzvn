# Video Operator – Emergency Flowchart

```
                     ┌──────────────────────────┐
                     │   VIDEO-PROBLEM IM LIVE   │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 0–5 SEK: BACKUP BILD AN  │
                     │ (Fallback Input / Cam)   │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP?                  │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │   KEIN BILD     │   │ FALSCHES BILD    │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Kumo Salvo „Standard“ laden  │   │ Routing prüfen               │
    │ SDI prüfen                   │   │ TriCaster Input neu zuweisen │
    │ TriCaster Input neu setzen   │   │ Unreal / PTZ prüfen          │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ PTZ AUSFALL     │   │ UNREAL AUSFALL   │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Auf andere Kamera schalten   │   │ Auf Standard-Kamera schalten │
    │ PoE++ prüfen                 │   │ Decklink Output prüfen        │
    │ IP prüfen (192.168.10.xx)    │   │ Szene neu laden               │
    │ Control Center neu starten   │   │ Routing zur Kumo prüfen       │
    └──────────────────────────────┘   └──────────────────────────────┘
```