# Audio Operator – Emergency Flowchart

```
                     ┌──────────────────────────┐
                     │   AUDIO-PROBLEM IM LIVE   │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 0–5 SEK: BACKUP AUDIO AN │
                     │ (Backup Mix / Handsender)│
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP?                  │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │   KEIN TON      │   │ TON ÜBERSTEUERT │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ SQ-5 Input prüfen            │   │ Gain reduzieren              │
    │ Fader hoch / Mute aus        │   │ Sender-Gain prüfen           │
    │ Dante 15/16 prüfen           │   │ Headset korrekt setzen       │
    │ Mikrofon eingeschaltet?      │   │ Limiter/Compressor prüfen    │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ FUNK AUSFALL    │   │ DANTE AUSFALL    │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Backup-Handsender geben      │   │ Dante Controller öffnen       │
    │ Frequenz wechseln            │   │ Clock Master prüfen           │
    │ Sender koppeln               │   │ Patchplan neu laden           │
    │ Antennen ausrichten          │   │ SQ-5 neu starten              │
    └──────────────────────────────┘   └──────────────────────────────┘
```