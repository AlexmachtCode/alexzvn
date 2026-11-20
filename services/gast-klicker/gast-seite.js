// Gast-Seite des Gast-Klickers (#317): zwei große Knöpfe, Pfeiltasten, Vorschaubild der aktuellen Folie.
// Eine Datei, alles inline (die CSP des Workers erlaubt nichts von außen). Englisch, Deutsch bei deutschem
// Browser. Spricht per WebSocket mit /k/<raum>/ws desselben Hosts.
import { RAUM_RE } from './raum.js';

const STIL = `
:root{color-scheme:dark;--bg:#111;--fl:#1c1c1c;--li:#333;--fg:#f2f2f2;--mu:#9a9a9a;--ok:#3ecf6e;--wa:#e6b422;--ak:#2f7cf6}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:900px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:14px;min-height:100vh}
h1{font-size:18px;font-weight:600;margin:0;color:var(--mu)}
.rahmen{position:relative;width:100%;aspect-ratio:16/9;background:#000;border:1px solid var(--li);border-radius:10px;overflow:hidden}
#bild{width:100%;height:100%;object-fit:contain;display:block}
#bild.leer{visibility:hidden}
#pos{font-size:28px;font-weight:700;text-align:center;letter-spacing:.02em}
.knoepfe{display:grid;grid-template-columns:1fr 1fr;gap:12px}
button{min-height:max(96px,20vh);font-size:28px;font-weight:700;color:var(--fg);background:var(--fl);border:2px solid var(--li);border-radius:14px;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none}
button:active{background:#2a2a2a}
button:disabled{opacity:.35;cursor:default}
button.wartet{border-color:var(--ak);box-shadow:0 0 0 3px rgba(47,124,246,.35) inset}
#status{display:flex;align-items:center;gap:8px;color:var(--mu);font-size:15px}
#status::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--wa);flex:none}
#status.ok::before{background:var(--ok)}
#hinweis{min-height:1.4em;color:var(--wa);font-size:15px}
.aus .knoepfe,.aus .rahmen,.aus #pos{display:none}
`;

const SKRIPT = `
(function(){
  var de = /^de\\b/i.test(navigator.language || '');
  var T = de ? {
    titel:'Folien weiterschalten', zurueck:'\\u25C0 Zur\\u00fcck', weiter:'Weiter \\u25B6',
    verbindet:'Verbinde \\u2026', verbunden:'Verbunden \\u00b7 Pfeiltasten \\u2190 \\u2192 gehen auch',
    offline:'Presenter offline \\u2013 die Regie schaltet weiter', pausiert:'Pausiert \\u2013 die Regie schaltet gerade',
    keine:'Keine Pr\\u00e4sentation aktiv', schwarz:'Bildschirm ist schwarz geschaltet', weiss:'Bildschirm ist wei\\u00df geschaltet',
    unbestaetigt:'Klick nicht best\\u00e4tigt \\u2013 Verbindung pr\\u00fcfen', weg:'Verbindung weg \\u2013 verbinde neu \\u2026',
    nichtAktiv:'Dieser Link ist nicht aktiv.', folie:'Folie'
  } : {
    titel:'Advance your slides', zurueck:'\\u25C0 Back', weiter:'Next \\u25B6',
    verbindet:'Connecting \\u2026', verbunden:'Connected \\u00b7 arrow keys \\u2190 \\u2192 work too',
    offline:'Presenter offline \\u2013 the host is advancing the slides', pausiert:'Paused \\u2013 the host is advancing the slides',
    keine:'No presentation running', schwarz:'Screen is blanked (black)', weiss:'Screen is blanked (white)',
    unbestaetigt:'Click not confirmed \\u2013 check your connection', weg:'Connection lost \\u2013 reconnecting \\u2026',
    nichtAktiv:'This link is not active.', folie:'Slide'
  };
  var $ = function(id){ return document.getElementById(id); };
  var bildEl = $('bild'), posEl = $('pos'), statusEl = $('status'), hinweisEl = $('hinweis');
  var weiterEl = $('weiter'), zurueckEl = $('zurueck');
  document.documentElement.lang = de ? 'de' : 'en';
  document.title = T.titel;
  $('titel').textContent = T.titel;
  weiterEl.textContent = T.weiter;
  zurueckEl.textContent = T.zurueck;

  var ws = null, versuch = 0, aus = false, letzteUrl = null, stand = null;
  var wartet = null, warteTimer = null, zuletztGeschickt = 0;

  function setStatus(text, ok){ statusEl.textContent = text; statusEl.className = ok ? 'ok' : ''; }
  function kannKlicken(){ return !!(ws && ws.readyState === 1 && stand && stand.presenter && stand.aktiv && !stand.pausiert); }

  function zeige(){
    if (!stand) return;
    posEl.textContent = stand.aktiv && stand.total > 0 ? T.folie + ' ' + (stand.index + 1) + ' / ' + stand.total : '\\u2013';
    weiterEl.disabled = zurueckEl.disabled = !kannKlicken();
    if (!stand.presenter) setStatus(T.offline, false);
    else if (!stand.aktiv) setStatus(T.keine, false);
    else if (stand.pausiert) setStatus(T.pausiert, false);
    else setStatus(T.verbunden, true);
    if (!wartet) hinweisEl.textContent = stand.aktiv && stand.screen === 'black' ? T.schwarz : stand.aktiv && stand.screen === 'white' ? T.weiss : '';
  }

  function bestaetige(){
    if (!wartet) return;
    wartet.classList.remove('wartet');
    wartet = null;
    clearTimeout(warteTimer);
  }

  function zeigeBild(daten){
    var u = URL.createObjectURL(new Blob([daten], { type: 'image/jpeg' }));
    bildEl.src = u;
    bildEl.classList.remove('leer');
    if (letzteUrl) URL.revokeObjectURL(letzteUrl);
    letzteUrl = u;
  }

  function nichtAktiv(){
    aus = true;
    document.body.classList.add('aus');
    setStatus(T.nichtAktiv, false);
    hinweisEl.textContent = '';
  }

  function verbinde(){
    if (aus) return;
    setStatus(T.verbindet, false);
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(proto + location.host + '/k/' + RAUM + '/ws');
    ws.binaryType = 'arraybuffer';
    ws.onopen = function(){ versuch = 0; };
    ws.onmessage = function(e){
      if (typeof e.data !== 'string') { zeigeBild(e.data); return; }
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'stand') { stand = m; bestaetige(); zeige(); }
      else if (m.t === 'nichtAktiv') nichtAktiv();
    };
    ws.onclose = function(){
      ws = null;
      if (aus) return;
      weiterEl.disabled = zurueckEl.disabled = true;
      setStatus(T.weg, false);
      var ms = Math.min(30000, 1000 * Math.pow(2, versuch++));
      setTimeout(verbinde, ms * (0.8 + Math.random() * 0.4));
    };
  }

  function klick(dir){
    var jetzt = Date.now();
    if (!kannKlicken() || jetzt - zuletztGeschickt < 200) return;
    zuletztGeschickt = jetzt;
    ws.send(JSON.stringify({ t: 'cmd', dir: dir }));
    if (wartet) wartet.classList.remove('wartet');
    wartet = dir === 'next' ? weiterEl : zurueckEl;
    wartet.classList.add('wartet');
    clearTimeout(warteTimer);
    warteTimer = setTimeout(function(){
      if (!wartet) return;
      wartet.classList.remove('wartet');
      wartet = null;
      hinweisEl.textContent = T.unbestaetigt;
    }, 3000);
  }

  weiterEl.addEventListener('click', function(){ klick('next'); });
  zurueckEl.addEventListener('click', function(){ klick('prev'); });
  document.addEventListener('keydown', function(e){
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); klick('next'); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); klick('prev'); }
  });
  weiterEl.disabled = zurueckEl.disabled = true;
  verbinde();
})();
`;

/** HTML der Gast-Seite für `raum` (nur gültige Raum-Kennungen, sonst Fehler). */
export function gastSeiteHtml(raum) {
  if (typeof raum !== 'string' || !RAUM_RE.test(raum)) throw new Error('ungültige Raum-Kennung');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Advance your slides</title>
<style>${STIL}</style>
</head>
<body>
<main>
  <h1 id="titel">Advance your slides</h1>
  <div class="rahmen"><img id="bild" class="leer" alt=""></div>
  <div id="pos">–</div>
  <div class="knoepfe">
    <button id="zurueck" type="button">◀ Back</button>
    <button id="weiter" type="button">Next ▶</button>
  </div>
  <div id="status">Connecting …</div>
  <div id="hinweis"></div>
</main>
<script>var RAUM = ${JSON.stringify(raum)};${SKRIPT}</script>
</body>
</html>`;
}
