// Selbst genügsame HTML-Seite der Handy-Fernbedienung (kein Build, keine externen
// Assets). Verbindet sich per EventSource(/events) und schickt Kommandos per
// fetch(POST /cmd). Big-Touch-UI im JM-Look (dunkel + Gelb).
export const REMOTE_PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>JM Prompter — Fernbedienung</title>
<style>
  :root { --bg:#121212; --fg:#fff; --muted:#9a9a9a; --line:#2a2a2a; --yellow:#fbe73b; --dark:#161616; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { margin:0; height:100%; background:var(--bg); color:var(--fg);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; user-select:none; }
  body { display:flex; flex-direction:column; padding:16px; gap:14px; max-width:560px; margin:0 auto; }
  header { display:flex; align-items:center; gap:10px; }
  .dot { width:10px; height:10px; border-radius:50%; background:var(--muted); }
  .dot.on { background:var(--yellow); }
  h1 { font-size:15px; font-weight:800; letter-spacing:.08em; margin:0; text-transform:uppercase; }
  .state { margin-left:auto; font-size:13px; color:var(--muted); }
  button { font:inherit; color:var(--fg); border:1px solid var(--line); background:#1c1c1c;
    border-radius:14px; padding:18px; font-weight:800; font-size:17px; touch-action:manipulation; }
  button:active { background:#262626; }
  .go { padding:26px; font-size:24px; }
  .go.playing { background:var(--yellow); color:var(--dark); border-color:var(--yellow); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .speed { display:flex; align-items:center; gap:12px; }
  .speed .val { flex:1; text-align:center; font-variant-numeric:tabular-nums; font-weight:800; font-size:20px; }
  .sub { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.12em; margin:0 2px -4px; }
</style>
</head>
<body>
  <header>
    <span class="dot" id="dot"></span>
    <h1>JM Prompter</h1>
    <span class="state" id="state">verbinde…</span>
  </header>

  <button class="go" id="go" onclick="send({type:'toggle'})">▶ GO</button>

  <div class="grid">
    <button onclick="send({type:'nudge',value:-3})">↑ Zurück</button>
    <button onclick="send({type:'nudge',value:3})">↓ Vor</button>
  </div>

  <p class="sub">Tempo</p>
  <div class="speed">
    <button onclick="send({type:'speed',value:-0.2})">−</button>
    <span class="val" id="speed">–</span>
    <button onclick="send({type:'speed',value:0.2})">+</button>
  </div>

  <button onclick="send({type:'reset'})">⟲ An den Anfang</button>

<script>
  // P1 (#59): Zugriffs-Token aus der eigenen URL (?t=) lesen und an jeden Aufruf
  // anhängen. Der QR-Link trägt das Token; ohne Token (open-Modus) bleibt withT()
  // ein No-Op und die Fernbedienung funktioniert wie bisher.
  var T=new URLSearchParams(location.search).get('t')||'';
  function withT(p){ return T ? p+(p.indexOf('?')<0?'?':'&')+'t='+encodeURIComponent(T) : p; }
  function send(cmd){ fetch(withT('/cmd'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cmd)}).catch(function(){}); }
  var go=document.getElementById('go'), dot=document.getElementById('dot'),
      stateEl=document.getElementById('state'), speedEl=document.getElementById('speed');
  function apply(s){
    if(!s) return;
    var playing=!!s.playing;
    go.textContent = playing ? '❙❙ Pause' : '▶ GO';
    go.className = 'go' + (playing ? ' playing' : '');
    dot.className = 'dot' + (playing ? ' on' : '');
    stateEl.textContent = playing ? 'läuft' : 'pausiert';
    if(typeof s.speed==='number') speedEl.textContent = s.speed.toFixed(1) + ' Z/s';
  }
  function connect(){
    var es=new EventSource(withT('/events'));
    es.onmessage=function(e){ try{ apply(JSON.parse(e.data)); }catch(_){} };
    es.onerror=function(){ stateEl.textContent='getrennt – verbinde…'; };
  }
  connect();
</script>
</body>
</html>`;
