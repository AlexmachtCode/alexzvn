// JM Gast-Klicker (#317) — Raumlogik + Durable Object „KlickRaum“.
//
// Ein Raum je Event: der JM Presenter verbindet sich ausgehend (Rolle presenter), Remote-Gäste öffnen den Link
// im Browser (Rolle gast). Der Raum reicht von Gästen nur „next“/„prev“ an den Presenter weiter und verteilt
// dessen Stand (Folie n/m, Schwarz/Weiß, pausiert) und die JPEG-Vorschau an die Gäste. Der Presenter ist
// maßgeblich: er prüft Pause und laufende Präsentation selbst noch einmal.
//
// Sicherheit: Den Raum beansprucht der erste Presenter mit seinem Geheimnis (gespeichert wird nur dessen
// SHA-256); Gäste beanspruchen nie etwas — ein unbekannter, geschlossener oder verfallener Raum antwortet
// ihnen mit `nichtAktiv`. Drossel je Gast, Kappungen für Gastzahl und Nachrichtengrößen.
//
// Bewusst ohne Cloudflare-Importe: der Selbsttest (test/raum.test.mjs) und der Prüfstand des Presenters
// betreiben die Klasse mit einer Attrappe des DO-Kontexts. Nur `fetch` braucht die Workers-Laufzeit
// (WebSocketPair, Status 101).

export const RAUM_RE = /^[a-z0-9]{12}$/;
export const DROSSEL_MS = 150;
export const MAX_GAESTE = 30;
export const MAX_GAST_BYTES = 256;
export const MAX_BILD_BYTES = 262144;
export const VERFALL_MS = 7 * 24 * 3600 * 1000;

const MAX_PRESENTER_TEXT = 4096;
const GEHEIMNIS_RE = /^[a-f0-9]{64}$/;
const SCREENS = new Set(['live', 'black', 'white']);
const LEERER_STAND = { aktiv: false, index: 0, total: 0, screen: 'live', pausiert: false };

const istGanzzahl = (v) => Number.isInteger(v) && v >= 0;

function parseJson(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/** Gast-Nachricht → `{dir}` oder `null` (alles außer `{"t":"cmd","dir":"next"|"prev"}` ≤ 256 Byte). */
export function leseGastNachricht(roh) {
  if (typeof roh !== 'string') return null;
  if (new TextEncoder().encode(roh).byteLength > MAX_GAST_BYTES) return null;
  const o = parseJson(roh);
  if (!o || o.t !== 'cmd' || (o.dir !== 'next' && o.dir !== 'prev')) return null;
  return { dir: o.dir };
}

/** Presenter-Nachricht → hallo / stand / schliessen / bild oder `null`. */
export function lesePresenterNachricht(roh) {
  if (roh instanceof ArrayBuffer || ArrayBuffer.isView(roh)) {
    const n = roh.byteLength;
    return n > 0 && n <= MAX_BILD_BYTES ? { t: 'bild', daten: roh } : null;
  }
  if (typeof roh !== 'string' || roh.length > MAX_PRESENTER_TEXT) return null;
  const o = parseJson(roh);
  if (!o) return null;
  switch (o.t) {
    case 'hallo':
      return typeof o.geheimnis === 'string' && GEHEIMNIS_RE.test(o.geheimnis) ? { t: 'hallo', geheimnis: o.geheimnis } : null;
    case 'stand':
      if (typeof o.aktiv !== 'boolean' || typeof o.pausiert !== 'boolean') return null;
      if (!istGanzzahl(o.index) || !istGanzzahl(o.total) || !SCREENS.has(o.screen)) return null;
      return { t: 'stand', aktiv: o.aktiv, index: o.index, total: o.total, screen: o.screen, pausiert: o.pausiert };
    case 'schliessen':
      return { t: 'schliessen' };
    default:
      return null;
  }
}

/** SHA-256 als Hex (WebCrypto, in Workers und Node ≥ 20 vorhanden). */
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class KlickRaum {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Nur im Speicher der Instanz: nach dem Aufwachen aus der Hibernation leer (dann holt bildBitte das Bild neu).
    this.stand = null;
    this.bild = null;
  }

  jetzt() {
    return typeof this.ctx.jetzt === 'function' ? this.ctx.jetzt() : Date.now();
  }

  /** Workers-Einstieg: WebSocket annehmen, Rolle aus `x-rolle` (setzt worker.js). */
  async fetch(request) {
    const rolle = request.headers.get('x-rolle');
    const upgrade = (request.headers.get('Upgrade') ?? '').toLowerCase();
    if (upgrade !== 'websocket' || (rolle !== 'gast' && rolle !== 'presenter')) return new Response(null, { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    if (rolle === 'gast') await this.nimmGastAn(server);
    else await this.nimmPresenterAn(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async raumAktiv() {
    const hash = await this.ctx.storage.get('hash');
    const zu = await this.ctx.storage.get('geschlossen');
    return Boolean(hash) && zu !== true;
  }

  anhang(ws) {
    try {
      return ws.deserializeAttachment() ?? {};
    } catch {
      return {};
    }
  }

  sende(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* Verbindung schon weg */
    }
  }

  schliesse(ws, code, grund) {
    const a = this.anhang(ws);
    a.weg = true;
    try {
      ws.serializeAttachment(a);
    } catch {
      /* egal */
    }
    try {
      ws.close(code, grund);
    } catch {
      /* schon zu */
    }
  }

  gaeste() {
    return this.ctx.getWebSockets('gast').filter((ws) => !this.anhang(ws).weg);
  }

  presenter() {
    return this.ctx.getWebSockets('presenter').find((ws) => {
      const a = this.anhang(ws);
      return a.bestaetigt === true && !a.weg;
    });
  }

  standFuerGast() {
    return { t: 'stand', ...(this.stand ?? LEERER_STAND), presenter: Boolean(this.presenter()) };
  }

  anAlleGaeste(obj) {
    for (const g of this.gaeste()) this.sende(g, obj);
  }

  meldeGaeste() {
    const p = this.presenter();
    if (p) this.sende(p, { t: 'gaeste', n: this.gaeste().length });
  }

  async nimmGastAn(ws) {
    const aktiv = await this.raumAktiv();
    const voll = this.gaeste().length >= MAX_GAESTE;
    this.ctx.acceptWebSocket(ws, ['gast']);
    ws.serializeAttachment({ rolle: 'gast', zuletztMs: 0 });
    if (!aktiv) {
      this.sende(ws, { t: 'nichtAktiv' });
      this.schliesse(ws, 4404, 'nicht aktiv');
      return;
    }
    if (voll) {
      this.schliesse(ws, 4429, 'voll');
      return;
    }
    this.sende(ws, this.standFuerGast());
    const p = this.presenter();
    if (this.bild) {
      try {
        ws.send(this.bild);
      } catch {
        /* weg */
      }
    } else if (p) {
      this.sende(p, { t: 'bildBitte' });
    }
    this.meldeGaeste();
  }

  async nimmPresenterAn(ws) {
    this.ctx.acceptWebSocket(ws, ['presenter']);
    ws.serializeAttachment({ rolle: 'presenter', bestaetigt: false });
  }

  async webSocketMessage(ws, msg) {
    const a = this.anhang(ws);
    if (a.weg) return;
    if (a.rolle === 'gast') return this.gastNachricht(ws, a, msg);
    if (a.rolle === 'presenter') return this.presenterNachricht(ws, a, msg);
  }

  gastNachricht(ws, a, msg) {
    const m = leseGastNachricht(msg);
    if (!m) return;
    const jetzt = this.jetzt();
    if (jetzt - (a.zuletztMs ?? 0) < DROSSEL_MS) return;
    a.zuletztMs = jetzt;
    ws.serializeAttachment(a);
    const p = this.presenter();
    if (!p || this.stand?.pausiert === true) return;
    this.sende(p, { t: 'cmd', dir: m.dir });
  }

  async presenterNachricht(ws, a, msg) {
    const m = lesePresenterNachricht(msg);
    if (!m) return;
    if (a.bestaetigt !== true) {
      if (m.t !== 'hallo') return;
      const hash = await sha256Hex(m.geheimnis);
      const gespeichert = await this.ctx.storage.get('hash');
      if (gespeichert && gespeichert !== hash) {
        this.sende(ws, { t: 'abgelehnt' });
        this.schliesse(ws, 4403, 'abgelehnt');
        return;
      }
      if (!gespeichert) await this.ctx.storage.put('hash', hash);
      await this.ctx.storage.delete('geschlossen');
      for (const alt of this.ctx.getWebSockets('presenter')) {
        if (alt !== ws && this.anhang(alt).bestaetigt === true && !this.anhang(alt).weg) this.schliesse(alt, 4409, 'ersetzt');
      }
      a.bestaetigt = true;
      ws.serializeAttachment(a);
      const jetzt = this.jetzt();
      await this.ctx.storage.put('letzterPresenterMs', jetzt);
      await this.ctx.storage.setAlarm(jetzt + VERFALL_MS);
      this.sende(ws, { t: 'ok' });
      this.sende(ws, { t: 'gaeste', n: this.gaeste().length });
      this.anAlleGaeste(this.standFuerGast());
      return;
    }
    switch (m.t) {
      case 'stand': {
        const { t: _t, ...stand } = m;
        this.stand = stand;
        this.anAlleGaeste(this.standFuerGast());
        return;
      }
      case 'bild':
        this.bild = m.daten;
        for (const g of this.gaeste()) {
          try {
            g.send(m.daten);
          } catch {
            /* weg */
          }
        }
        return;
      case 'schliessen':
        await this.ctx.storage.put('geschlossen', true);
        this.stand = null;
        this.bild = null;
        for (const g of this.gaeste()) {
          this.sende(g, { t: 'nichtAktiv' });
          this.schliesse(g, 4404, 'nicht aktiv');
        }
        return;
      default:
        return;
    }
  }

  async webSocketClose(ws, code, grund) {
    const a = this.anhang(ws);
    try {
      ws.close(code === 1005 || code === 1006 || !code ? 1000 : code, grund);
    } catch {
      /* schon zu */
    }
    if (a.weg) return;
    a.weg = true;
    try {
      ws.serializeAttachment(a);
    } catch {
      /* egal */
    }
    if (a.rolle === 'gast') this.meldeGaeste();
    else if (a.rolle === 'presenter' && a.bestaetigt === true) this.anAlleGaeste(this.standFuerGast());
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011, 'fehler');
  }

  async alarm() {
    if (this.presenter()) {
      await this.ctx.storage.setAlarm(this.jetzt() + VERFALL_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
    this.stand = null;
    this.bild = null;
    for (const g of this.gaeste()) {
      this.sende(g, { t: 'nichtAktiv' });
      this.schliesse(g, 4404, 'verfallen');
    }
  }
}
