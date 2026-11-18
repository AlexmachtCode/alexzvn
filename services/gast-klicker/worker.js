// JM Gast-Klicker (#317) — Cloudflare-Worker `jm-gast-klicker`.
//
//   GET /k/<raum>      Gast-Seite (HTML, strenge CSP)
//   GET /k/<raum>/ws   WebSocket Gast       → Durable Object KlickRaum (Rolle gast)
//   GET /h/<raum>/ws   WebSocket Presenter  → Durable Object KlickRaum (Rolle presenter, Geheimnis in der 1. Nachricht)
//   alles andere       404
//
// Eigener Worker, bewusst getrennt vom Suite-Proxy (services/release-proxy): der läuft live mit dem Stand der
// Launcher-Anmeldung aus einem eigenen Branch; ein gemeinsamer Deploy würde ihn zurückdrehen.
import { KlickRaum, RAUM_RE } from './raum.js';
import { gastSeiteHtml } from './gast-seite.js';

export { KlickRaum };

const PFAD = /^\/(k|h)\/([^/]+)(\/ws)?$/;

function leer(status) {
  return new Response(null, { status, headers: { 'cache-control': 'no-store' } });
}

function seite(raum, url) {
  const host = url.host;
  const connect = `wss://${host}` + (url.protocol === 'http:' ? ` ws://${host}` : '');
  return new Response(gastSeiteHtml(raum), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src blob:; ` +
        `connect-src ${connect}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(PFAD);
    if (!m || request.method !== 'GET' || !RAUM_RE.test(m[2])) return leer(404);
    const [, art, raum, ws] = m;
    if (!ws) return art === 'k' ? seite(raum, url) : leer(404);
    if ((request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') return leer(426);
    const ns = env.KLICK_RAUM.jurisdiction('eu');
    const stub = ns.get(ns.idFromName(raum));
    const headers = new Headers(request.headers);
    headers.set('x-rolle', art === 'k' ? 'gast' : 'presenter');
    // Der DO kennt seinen Namen nicht; der Presenter muss beweisen, dass sein Geheimnis zu GENAU diesem Raum gehört.
    headers.set('x-raum', raum);
    return stub.fetch(new Request(request, { headers }));
  },
};
