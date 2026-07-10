// ─────────────────────────────────────────────────────────────────────────────
// Die Sandbox-Testumgebung.
//
// Der Frame lädt `jmapp://preview/index.html` — dieselbe Seite, die der Export auf
// die Platte schreibt. Er läuft unter einer eigenen Origin, kann das Editor-DOM
// also nicht anfassen; alles geht über postMessage.
//
// `event.origin` trägt hier keine Information (bei file://-Editoren ist sie
// "null"), deshalb prüfen wir Absender (`event.source`) UND einen Sitzungs-nonce.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { TRIGGER_LABELS, type AppProject, type TriggerType } from '@jm/appkit';
import { useEditor } from '../store';

const PREVIEW_ORIGIN = 'jmapp://preview';
/** Tippen im Textfeld soll die Vorschau nicht bei jedem Anschlag neu aufbauen. */
const DOC_PUSH_MS = 120;

type FromPlayer =
  | { t: 'ready'; nonce: string }
  | { t: 'vars'; nonce: string; vars: Record<string, number | string | boolean> }
  | { t: 'event'; nonce: string; trigger: TriggerType; ruleId: string; nodeId?: string }
  | { t: 'scene'; nonce: string; sceneId: string }
  | { t: 'error'; nonce: string; message: string };

function makeNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function PreviewFrame(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const assets = useEditor((s) => s.assets);
  const sceneId = useEditor((s) => s.sceneId);
  const pushLog = useEditor((s) => s.pushLog);
  const setVars = useEditor((s) => s.setVars);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef<string>(makeNonce());
  const readyRef = useRef(false);
  // Beim `ready` brauchen wir den aktuellen Stand, nicht den aus der Closure.
  const sceneIdRef = useRef(sceneId);
  const docRef = useRef<AppProject>(doc);
  sceneIdRef.current = sceneId;
  docRef.current = doc;

  const [src, setSrc] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const post = useCallback((msg: Record<string, unknown>): void => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current) return;
    win.postMessage({ ...msg, nonce: nonceRef.current }, PREVIEW_ORIGIN);
  }, []);

  // Dokument + Assets in den Vorschau-Speicher stellen, DANN den Frame laden.
  // Ein Reload ohne vorheriges publish zeigte sonst den alten Stand.
  // Neue Medien brauchen einen echten Reload (der Frame löst Asset-URLs beim
  // Rendern auf); reine Dokument-Änderungen laufen unten über postMessage.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await window.jmapp.publish(docRef.current, assets);
      if (cancelled) return;
      const url = await window.jmapp.previewUrl();
      if (!cancelled) setSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, reloadKey]);

  useEffect(() => {
    const onMessage = (e: MessageEvent): void => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const msg = e.data as FromPlayer | null;
      if (!msg || typeof msg !== 'object' || msg.nonce !== nonceRef.current) return;

      switch (msg.t) {
        case 'ready':
          // Erst jetzt ist der Player empfangsbereit — vorher gingen Nachrichten
          // ins Leere. Den aktuellen Editor-Stand nachreichen.
          readyRef.current = true;
          post({ t: 'goto', sceneId: sceneIdRef.current });
          break;
        case 'vars':
          setVars(msg.vars);
          break;
        case 'event':
          pushLog(`${TRIGGER_LABELS[msg.trigger] ?? msg.trigger} → Regel gefeuert`);
          break;
        case 'scene': {
          const name = docRef.current.scenes.find((s) => s.id === msg.sceneId)?.name ?? msg.sceneId;
          pushLog(`Szene: ${name}`);
          break;
        }
        case 'error':
          pushLog(`Fehler: ${msg.message}`);
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, pushLog, setVars]);

  /** Handschlag: der Frame kennt seinen nonce erst, wenn wir ihn schicken. */
  const onLoad = (): void => {
    readyRef.current = false;
    iframeRef.current?.contentWindow?.postMessage(
      { t: 'hello', nonce: nonceRef.current },
      PREVIEW_ORIGIN,
    );
  };

  // Live-Reload, entprellt. Der Player baut die Szene neu, startet sie aber nicht
  // (kein onLoad, keine Timer) — sonst würde Tippen das Spiel zurücksetzen.
  useEffect(() => {
    const t = window.setTimeout(() => post({ t: 'doc', doc }), DOC_PUSH_MS);
    return () => window.clearTimeout(t);
  }, [doc, post]);

  useEffect(() => {
    post({ t: 'goto', sceneId });
  }, [sceneId, post]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Sandbox
        </span>
        <div className="flex gap-1">
          <button
            className="rounded px-2 py-1 text-xs hover:bg-[var(--muted)]"
            onClick={() => post({ t: 'reset' })}
          >
            Von vorn
          </button>
          <button
            className="rounded px-2 py-1 text-xs hover:bg-[var(--muted)]"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Frame komplett neu laden (nach Medien-Import)"
          >
            Neu laden
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-black">
        {src && (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={src}
            onLoad={onLoad}
            title="App-Vorschau"
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}
