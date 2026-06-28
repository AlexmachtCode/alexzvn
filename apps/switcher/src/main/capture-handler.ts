import { desktopCapturer, session } from 'electron';

// Zuletzt per armCapture() gewählte Quelle. getDisplayMedia() im Renderer löst
// den Handler aus, der genau diese Quelle liefert (kein System-Picker-Dialog).
let pendingSourceId: string | null = null;

export function armCapture(sourceId: string): void {
  pendingSourceId = sourceId;
}

/** Einmalig beim App-Start registrieren. */
export function installDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (!pendingSourceId) {
      callback({});
      return;
    }
    const want = pendingSourceId;
    desktopCapturer
      .getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        const source = sources.find((s) => s.id === want) ?? sources[0];
        callback(source ? { video: source } : {});
      })
      .catch(() => callback({}));
  });

  // getUserMedia (Capture-Karte/Kamera) braucht eine erteilte media-Permission —
  // für eine Desktop-App pauschal erlauben (kein Browser-Sandboxing nötig).
  // Außerdem `fullscreen`: das Multiview-Overlay wirft sich per HTML-Fullscreen-API
  // (element.requestFullscreen) auf den Monitor; ohne erteilte fullscreen-Permission
  // lehnt Electron das ab → der „Vollbild"-Button tat nichts (#88).
  const allow = (permission: string): boolean =>
    permission === 'media' || permission === 'fullscreen';
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(allow(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow(permission));
}
