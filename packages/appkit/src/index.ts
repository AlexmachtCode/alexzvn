// @jm/appkit — Dokumentmodell, Logikmodell und Laufzeit des JM App Designers.
//
// Reines Web: kein `electron`, kein `node:*`. Dieselbe Runtime läuft in der
// Editor-Sandbox, im Kiosk-Fenster und im exportierten Bundle.
//
// Achtung: `runtime/entry.ts` wird hier bewusst NICHT re-exportiert — es startet
// die App beim Laden und ist ausschließlich Einstiegspunkt des IIFE-Builds.

export * from './constants';
export * from './model';
export * from './logic';
export * from './migrate';
export { mountApp } from './runtime/player';
export type { MountOptions, RuntimeEvent, RuntimeHandle } from './runtime/player';
export { createWheel, sliceSegments, segmentAt } from './runtime/wheel';
export type { WheelView } from './runtime/wheel';
export { buildIndexHtml, PREVIEW_CSP_META } from './export/bundle';
export type { BundleHtmlOptions } from './export/bundle';
