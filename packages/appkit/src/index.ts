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
export { shuffled } from './runtime/widget';
export type { Widget, WidgetContext } from './runtime/widget';
export { createWheel, sliceSegments, segmentAt } from './runtime/wheel';
export type { WheelWidget } from './runtime/wheel';
export { createQuiz } from './runtime/quiz';
export type { QuizWidget } from './runtime/quiz';
export { createMemory } from './runtime/memory';
export { createDragLayer } from './runtime/dragdrop';
export type { DragLayer, DragSource, DragTarget } from './runtime/dragdrop';
export { buildIndexHtml, PREVIEW_CSP_META } from './export/bundle';
export type { BundleHtmlOptions } from './export/bundle';
