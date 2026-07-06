// @jm/rtc — Geteilter Remote-A/V-Kern der Suite (Welle 6 „JM Connect“).
//
// Der Root-Export ist ISOMORPH und darf gefahrlos im Cloudflare-Worker/DO, im Electron-Main und
// im Renderer importiert werden. Renderer-only-Teile sind BEWUSST NUR als Sub-Pfad verfügbar:
//   • @jm/rtc/frames      — WebCodecs↔NDI-Konverter (braucht VideoFrame/AudioData)
//   • @jm/rtc/signalling  — WebSocket-Client (braucht globalThis.WebSocket)
// So bleibt der Root frei von umgebungsspezifischen Globals.
//
// Endungslose Imports (wie der Rest des Repos) — Bundler/tsx/electron-vite lösen sie auf.

export * from './protocol';
export * from './state';
export * from './token';
export * from './turn';
export * from './sfu';
export * from './cf-sfu';
