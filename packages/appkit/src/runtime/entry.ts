// ─────────────────────────────────────────────────────────────────────────────
// Einstiegspunkt des gebauten Runtime-Bundles (`dist/runtime.js`, IIFE).
//
// Wird als klassisches <script src> geladen — NICHT als ES-Modul: unter `file://`
// blockiert CORS jedes `<script type="module">`, und das exportierte Bundle soll
// per Doppelklick laufen.
//
// Das Dokument steht inline in der Seite (`<script type="application/json">`),
// nicht in einer app.json: `fetch()` scheitert unter `file://` an der null-Origin.
//
// Läuft die Seite in einem iframe, schaltet sie zusätzlich die Editor-Bridge frei.
// Derselbe Code, dieselben Asset-Pfade — Vorschau und Export können nicht driften.
// ─────────────────────────────────────────────────────────────────────────────

import { migrateProject } from '../migrate';
import { mountApp, type RuntimeEvent, type RuntimeHandle } from './player';
import { ASSET_DIR, DOC_SCRIPT_ID, ROOT_ID } from '../constants';
import type { AppProject } from '../model';

/** Asset-ID → relativer Pfad. Relativ funktioniert unter file://, jmapp:// und http. */
function assetResolver(doc: AppProject): (id: string) => string {
  const byId = new Map(doc.assets.map((a) => [a.id, a.fileName]));
  return (id) => {
    const file = byId.get(id);
    return file ? `${ASSET_DIR}/${encodeURIComponent(file)}` : '';
  };
}

function readInlineDoc(): AppProject | null {
  const el = document.getElementById(DOC_SCRIPT_ID);
  if (!el || !el.textContent) return null;
  try {
    return migrateProject(JSON.parse(el.textContent));
  } catch (err) {
    console.error('[jmapp] Dokument konnte nicht gelesen werden', err);
    return null;
  }
}

// ── Editor-Bridge (nur im iframe) ────────────────────────────────────────────
// Der Frame läuft unter jmapp://preview, der Editor unter http(s)/file — also
// cross-origin. DOM-Zugriff ist damit vom Browser unterbunden; alles geht über
// postMessage. Wir prüfen Absender (event.source) und einen Sitzungs-nonce,
// denn event.origin ist bei file://-Editoren "null" und trägt keine Information.

type ToPlayer =
  | { t: 'hello'; nonce: string }
  | { t: 'doc'; nonce: string; doc: unknown }
  | { t: 'goto'; nonce: string; sceneId: string }
  | { t: 'reset'; nonce: string };

function installBridge(handle: RuntimeHandle): void {
  let nonce: string | null = null;

  const send = (msg: Record<string, unknown>): void => {
    if (!nonce) return;
    window.parent.postMessage({ ...msg, nonce }, '*');
  };

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const msg = e.data as ToPlayer | null;
    if (!msg || typeof msg !== 'object' || typeof msg.nonce !== 'string') return;

    if (msg.t === 'hello') {
      nonce = msg.nonce;
      send({ t: 'ready' });
      send({ t: 'vars', vars: handle.getVars() });
      return;
    }
    if (!nonce || msg.nonce !== nonce) return;

    switch (msg.t) {
      case 'doc':
        handle.update(migrateProject(msg.doc));
        break;
      case 'goto':
        handle.goToScene(msg.sceneId);
        break;
      case 'reset':
        handle.restart();
        break;
    }
  });

  // Runtime-Ereignisse an den Editor weiterreichen (Variablen-Inspektor, Trigger-Log).
  // Vor dem `hello` verwirft `send` alles — der Editor holt sich den Anfangszustand
  // dort ohnehin explizit ab.
  window.__jmappEmit = (e: RuntimeEvent) => {
    if (e.kind === 'vars') send({ t: 'vars', vars: e.vars });
    else if (e.kind === 'trigger') send({ t: 'event', trigger: e.trigger, ruleId: e.ruleId, nodeId: e.nodeId });
    else if (e.kind === 'error') send({ t: 'error', message: e.message });
    else if (e.kind === 'scene') send({ t: 'scene', sceneId: e.sceneId });
  };
}

declare global {
  interface Window {
    __jmappEmit?: (e: RuntimeEvent) => void;
    JMApp?: { handle: RuntimeHandle | null };
  }
}

function boot(): void {
  const root = document.getElementById(ROOT_ID) ?? document.body;
  const doc = readInlineDoc();
  if (!doc) {
    root.textContent = 'Kein App-Dokument gefunden.';
    return;
  }

  const handle = mountApp({
    doc,
    root: root as HTMLElement,
    resolveAsset: assetResolver(doc),
    onEvent: (e) => window.__jmappEmit?.(e),
  });

  window.JMApp = { handle };
  if (window.parent !== window) installBridge(handle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
